-- Editais: ingestão em lote + pipeline por estágio (re-executável) + regras versionadas (JSON) + notificações
-- MVP focado em: estrutura + fluxo + idempotência por hash + falha parcial + retomada
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- =========================================
-- Tipos
-- =========================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'edital_stage') then
    create type public.edital_stage as enum ('extract','classify','normalize','evaluate','conclude');
  end if;
  if not exists (select 1 from pg_type where typname = 'edital_job_status') then
    create type public.edital_job_status as enum ('queued','running','done','error','retry');
  end if;
  if not exists (select 1 from pg_type where typname = 'edital_verdict') then
    create type public.edital_verdict as enum ('APTO','INAPTO','APTO_COM_RESSALVAS','REVISAO_HUMANA');
  end if;
end $$;

-- Reset a partir de um estágio (para reprocessar regras sem re-extrair PDF)
create or replace function public.reset_edital_batch_from_stage(p_batch_id uuid, p_stage public.edital_stage default 'evaluate')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  -- exige permissão se existir
  if exists(select 1 from pg_proc where proname='has_permission') then
    if not public.has_permission('editais.manage') then
      raise exception 'Sem permissão: editais.manage';
    end if;
  end if;

  update public.edital_jobs j
  set current_stage = p_stage,
      status = 'queued',
      last_error = null,
      locked_at = null,
      locked_by = null,
      updated_at = now()
  from public.editais e
  where e.id = j.edital_id
    and e.batch_id = p_batch_id;

  get diagnostics n = row_count;

  update public.editais
  set status = 'queued',
      updated_at = now()
  where batch_id = p_batch_id;

  update public.edital_batches
  set status = 'processing',
      updated_at = now()
  where id = p_batch_id;

  return n;
end $$;

-- =========================================
-- Lotes + Arquivos
-- =========================================
create table if not exists public.edital_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid null, -- auth.users.id
  status text not null default 'queued' check (status in ('queued','processing','done','error')),
  total_files int not null default 0,
  processed_files int not null default 0,
  error_files int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edital_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.edital_batches(id) on delete cascade,
  sha256 text not null, -- idempotência
  original_filename text not null,
  mime_type text null,
  size_bytes bigint not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique(batch_id, sha256)
);

create index if not exists edital_files_batch_id_idx on public.edital_files(batch_id);

-- =========================================
-- Edital + Job (1 job por edital, avançando por estágio)
-- =========================================
create table if not exists public.editais (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.edital_batches(id) on delete cascade,
  file_id uuid not null references public.edital_files(id) on delete cascade,
  title text null,
  deadline_at timestamptz null,
  urgency_score int not null default 0,
  status text not null default 'queued' check (status in ('queued','processing','done','error')),
  verdict public.edital_verdict null,
  score numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, file_id)
);

create index if not exists editais_batch_id_idx on public.editais(batch_id);

create table if not exists public.edital_jobs (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.editais(id) on delete cascade,
  current_stage public.edital_stage not null default 'extract',
  status public.edital_job_status not null default 'queued',
  attempts int not null default 0,
  last_error text null,
  locked_at timestamptz null,
  locked_by uuid null, -- auth.uid
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(edital_id)
);

create index if not exists edital_jobs_status_idx on public.edital_jobs(status);
create index if not exists edital_jobs_locked_at_idx on public.edital_jobs(locked_at);

create table if not exists public.edital_stage_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.edital_jobs(id) on delete cascade,
  stage public.edital_stage not null,
  status public.edital_job_status not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  log jsonb not null default '{}'::jsonb
);

create index if not exists edital_stage_runs_job_id_idx on public.edital_stage_runs(job_id);

-- =========================================
-- Artefatos por estágio (re-executável)
-- =========================================
create table if not exists public.edital_extractions (
  edital_id uuid primary key references public.editais(id) on delete cascade,
  text text not null default '',
  sections jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0.0,
  updated_at timestamptz not null default now()
);

create table if not exists public.edital_classifications (
  edital_id uuid primary key references public.editais(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.edital_normalizations (
  edital_id uuid primary key references public.editais(id) on delete cascade,
  requirements jsonb not null default '[]'::jsonb,
  unknown_terms jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.edital_evaluations (
  edital_id uuid primary key references public.editais(id) on delete cascade,
  verdict public.edital_verdict not null default 'REVISAO_HUMANA',
  score numeric not null default 0,
  gaps jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  rule_set_id uuid null,
  rule_set_version int null,
  updated_at timestamptz not null default now()
);

-- =========================================
-- Regras (JSON tree) + versionamento simples
-- =========================================
create table if not exists public.edital_rule_sets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.edital_rule_set_versions (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.edital_rule_sets(id) on delete cascade,
  version int not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  tree jsonb not null, -- estrutura E/OU + condições
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique(rule_set_id, version)
);

create index if not exists edital_rule_set_versions_rule_set_id_idx on public.edital_rule_set_versions(rule_set_id);

create table if not exists public.edital_rule_audits (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.editais(id) on delete cascade,
  rule_set_id uuid not null references public.edital_rule_sets(id) on delete cascade,
  version int not null,
  verdict public.edital_verdict not null,
  score numeric not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================
-- Inventário interno de capacidades (central)
-- =========================================
create table if not exists public.company_capabilities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- ex.: 'certificacao.iso_9001'
  type text not null default 'boolean' check (type in ('boolean','number','text','json')),
  value jsonb not null default 'true'::jsonb,
  source text null, -- ex.: 'manual', 'ad', 'financeiro'
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Dicionário de termos (normalização)
create table if not exists public.edital_term_dictionary (
  id uuid primary key default gen_random_uuid(),
  pattern text not null, -- regex ou texto (MVP: regex no Postgres)
  internal_key text not null, -- ex.: 'certificacao.iso_9001'
  kind text not null default 'regex' check (kind in ('regex','contains')),
  created_at timestamptz not null default now(),
  unique(pattern, internal_key)
);

-- Termos desconhecidos (fila para analista)
create table if not exists public.edital_unknown_terms (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.edital_batches(id) on delete cascade,
  edital_id uuid not null references public.editais(id) on delete cascade,
  term text not null,
  context text null,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  resolved_to_key text null,
  created_at timestamptz not null default now(),
  unique(edital_id, term)
);

create index if not exists edital_unknown_terms_batch_id_idx on public.edital_unknown_terms(batch_id);

-- =========================================
-- Notificações (badge)
-- =========================================
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null, -- 'edital_batch_done'
  title text not null,
  body text null,
  meta jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_id_idx on public.user_notifications(user_id);
create index if not exists user_notifications_read_at_idx on public.user_notifications(read_at);

-- =========================================
-- Storage bucket: editais
-- =========================================
insert into storage.buckets (id, name, public)
values ('editais', 'editais', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='editais_rw_authenticated') then
    create policy "editais_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'editais')
      with check (bucket_id = 'editais');
  end if;
end $$;

-- =========================================
-- RLS
-- (MVP: leitura para authenticated; escrita exige permissão 'editais.manage' se has_permission existir)
-- =========================================
alter table public.edital_batches enable row level security;
alter table public.edital_files enable row level security;
alter table public.editais enable row level security;
alter table public.edital_jobs enable row level security;
alter table public.edital_stage_runs enable row level security;
alter table public.edital_extractions enable row level security;
alter table public.edital_classifications enable row level security;
alter table public.edital_normalizations enable row level security;
alter table public.edital_evaluations enable row level security;
alter table public.edital_rule_sets enable row level security;
alter table public.edital_rule_set_versions enable row level security;
alter table public.edital_rule_audits enable row level security;
alter table public.company_capabilities enable row level security;
alter table public.edital_term_dictionary enable row level security;
alter table public.edital_unknown_terms enable row level security;
alter table public.user_notifications enable row level security;

do $$
declare
  has_perm boolean;
begin
  select exists(select 1 from pg_proc where proname='has_permission') into has_perm;

  -- SELECT (authenticated)
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_batches' and policyname='edital_batches_select') then
    create policy "edital_batches_select" on public.edital_batches for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_files' and policyname='edital_files_select') then
    create policy "edital_files_select" on public.edital_files for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='editais' and policyname='editais_select') then
    create policy "editais_select" on public.editais for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_jobs' and policyname='edital_jobs_select') then
    create policy "edital_jobs_select" on public.edital_jobs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_stage_runs' and policyname='edital_stage_runs_select') then
    create policy "edital_stage_runs_select" on public.edital_stage_runs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_extractions' and policyname='edital_extractions_select') then
    create policy "edital_extractions_select" on public.edital_extractions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_classifications' and policyname='edital_classifications_select') then
    create policy "edital_classifications_select" on public.edital_classifications for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_normalizations' and policyname='edital_normalizations_select') then
    create policy "edital_normalizations_select" on public.edital_normalizations for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_evaluations' and policyname='edital_evaluations_select') then
    create policy "edital_evaluations_select" on public.edital_evaluations for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_rule_sets' and policyname='edital_rule_sets_select') then
    create policy "edital_rule_sets_select" on public.edital_rule_sets for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_rule_set_versions' and policyname='edital_rule_set_versions_select') then
    create policy "edital_rule_set_versions_select" on public.edital_rule_set_versions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_rule_audits' and policyname='edital_rule_audits_select') then
    create policy "edital_rule_audits_select" on public.edital_rule_audits for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='company_capabilities' and policyname='company_capabilities_select') then
    create policy "company_capabilities_select" on public.company_capabilities for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_term_dictionary' and policyname='edital_term_dictionary_select') then
    create policy "edital_term_dictionary_select" on public.edital_term_dictionary for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='edital_unknown_terms' and policyname='edital_unknown_terms_select') then
    create policy "edital_unknown_terms_select" on public.edital_unknown_terms for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_notifications' and policyname='user_notifications_select_own') then
    create policy "user_notifications_select_own" on public.user_notifications for select to authenticated using (user_id = auth.uid());
  end if;

  -- WRITE
  drop policy if exists "edital_batches_write" on public.edital_batches;
  drop policy if exists "edital_files_write" on public.edital_files;
  drop policy if exists "editais_write" on public.editais;
  drop policy if exists "edital_jobs_write" on public.edital_jobs;
  drop policy if exists "edital_stage_runs_write" on public.edital_stage_runs;
  drop policy if exists "edital_extractions_write" on public.edital_extractions;
  drop policy if exists "edital_classifications_write" on public.edital_classifications;
  drop policy if exists "edital_normalizations_write" on public.edital_normalizations;
  drop policy if exists "edital_evaluations_write" on public.edital_evaluations;
  drop policy if exists "edital_rule_sets_write" on public.edital_rule_sets;
  drop policy if exists "edital_rule_set_versions_write" on public.edital_rule_set_versions;
  drop policy if exists "edital_rule_audits_write" on public.edital_rule_audits;
  drop policy if exists "company_capabilities_write" on public.company_capabilities;
  drop policy if exists "edital_term_dictionary_write" on public.edital_term_dictionary;
  drop policy if exists "edital_unknown_terms_write" on public.edital_unknown_terms;
  drop policy if exists "user_notifications_write_own" on public.user_notifications;

  if has_perm then
    create policy "edital_batches_write" on public.edital_batches for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_files_write" on public.edital_files for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "editais_write" on public.editais for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_jobs_write" on public.edital_jobs for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_stage_runs_write" on public.edital_stage_runs for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_extractions_write" on public.edital_extractions for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_classifications_write" on public.edital_classifications for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_normalizations_write" on public.edital_normalizations for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_evaluations_write" on public.edital_evaluations for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_rule_sets_write" on public.edital_rule_sets for all to authenticated using (public.has_permission('editais.rules.manage')) with check (public.has_permission('editais.rules.manage'));
    create policy "edital_rule_set_versions_write" on public.edital_rule_set_versions for all to authenticated using (public.has_permission('editais.rules.manage')) with check (public.has_permission('editais.rules.manage'));
    create policy "edital_rule_audits_write" on public.edital_rule_audits for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "company_capabilities_write" on public.company_capabilities for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "edital_term_dictionary_write" on public.edital_term_dictionary for all to authenticated using (public.has_permission('editais.rules.manage')) with check (public.has_permission('editais.rules.manage'));
    create policy "edital_unknown_terms_write" on public.edital_unknown_terms for all to authenticated using (public.has_permission('editais.manage')) with check (public.has_permission('editais.manage'));
    create policy "user_notifications_write_own" on public.user_notifications for insert to authenticated with check (user_id = auth.uid());
  else
    create policy "edital_batches_write" on public.edital_batches for all to authenticated using (true) with check (true);
    create policy "edital_files_write" on public.edital_files for all to authenticated using (true) with check (true);
    create policy "editais_write" on public.editais for all to authenticated using (true) with check (true);
    create policy "edital_jobs_write" on public.edital_jobs for all to authenticated using (true) with check (true);
    create policy "edital_stage_runs_write" on public.edital_stage_runs for all to authenticated using (true) with check (true);
    create policy "edital_extractions_write" on public.edital_extractions for all to authenticated using (true) with check (true);
    create policy "edital_classifications_write" on public.edital_classifications for all to authenticated using (true) with check (true);
    create policy "edital_normalizations_write" on public.edital_normalizations for all to authenticated using (true) with check (true);
    create policy "edital_evaluations_write" on public.edital_evaluations for all to authenticated using (true) with check (true);
    create policy "edital_rule_sets_write" on public.edital_rule_sets for all to authenticated using (true) with check (true);
    create policy "edital_rule_set_versions_write" on public.edital_rule_set_versions for all to authenticated using (true) with check (true);
    create policy "edital_rule_audits_write" on public.edital_rule_audits for all to authenticated using (true) with check (true);
    create policy "company_capabilities_write" on public.company_capabilities for all to authenticated using (true) with check (true);
    create policy "edital_term_dictionary_write" on public.edital_term_dictionary for all to authenticated using (true) with check (true);
    create policy "edital_unknown_terms_write" on public.edital_unknown_terms for all to authenticated using (true) with check (true);
    create policy "user_notifications_write_own" on public.user_notifications for insert to authenticated with check (user_id = auth.uid());
  end if;
end $$;

-- Seeds: inventário e dicionário iniciais (MVP)
insert into public.company_capabilities (key, type, value, source)
values
  ('certificacao.iso_9001', 'boolean', 'true'::jsonb, 'manual'),
  ('certificacao.iso_27001', 'boolean', 'false'::jsonb, 'manual')
on conflict (key) do nothing;

insert into public.edital_term_dictionary (pattern, internal_key, kind)
values
  ('ISO\\s*9001', 'certificacao.iso_9001', 'regex'),
  ('ISO\\s*27001', 'certificacao.iso_27001', 'regex')
on conflict (pattern, internal_key) do nothing;

-- Seeds: conjunto padrão de regras (versão 1 publicada)
insert into public.edital_rule_sets (key, name, description)
values ('default', 'Padrão', 'Conjunto padrão de regras do MVP')
on conflict (key) do nothing;

do $$
declare
  rs_id uuid;
begin
  select id into rs_id from public.edital_rule_sets where key='default' limit 1;
  if rs_id is null then return; end if;

  if not exists (select 1 from public.edital_rule_set_versions where rule_set_id = rs_id and version = 1) then
    insert into public.edital_rule_set_versions (rule_set_id, version, status, tree)
    values (
      rs_id,
      1,
      'published',
      jsonb_build_object(
        'rules',
        jsonb_build_array(
          jsonb_build_object(
            'type','rule',
            'id','ko_iso_9001',
            'ruleType','KO',
            'title','ISO 9001',
            'message','Exige ISO 9001 vigente.',
            'when', jsonb_build_object('type','condition','field','capability','key','certificacao.iso_9001','operator','eq','value', true)
          ),
          jsonb_build_object(
            'type','rule',
            'id','score_iso_27001',
            'ruleType','SCORE',
            'title','Bônus ISO 27001',
            'weight', 5,
            'when', jsonb_build_object('type','condition','field','capability','key','certificacao.iso_27001','operator','eq','value', true)
          ),
          jsonb_build_object(
            'type','rule',
            'id','info_min_conf',
            'ruleType','INFO',
            'title','Confiança mínima da extração',
            'message','Extração com confiança baixa pode exigir revisão humana.',
            'when', jsonb_build_object('type','condition','field','extraction.confidence','operator','gte','value', 0.35)
          )
        )
      )
    );
  end if;
end $$;

-- =========================================
-- Claim job (skip locked) — para simular fila/worker via chamadas HTTP repetidas
-- =========================================
create or replace function public.claim_next_edital_job(p_batch_id uuid, p_lock_minutes int default 5)
returns table(job_id uuid, edital_id uuid, current_stage public.edital_stage)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_edital_id uuid;
  v_stage public.edital_stage;
begin
  -- pega 1 job elegível e trava
  with candidate as (
    select j.id
    from public.edital_jobs j
    join public.editais e on e.id = j.edital_id
    where e.batch_id = p_batch_id
      and j.status in ('queued','retry')
      and (j.locked_at is null or j.locked_at < now() - (p_lock_minutes || ' minutes')::interval)
    order by e.urgency_score desc, j.updated_at asc
    limit 1
    for update skip locked
  )
  update public.edital_jobs j
  set status = 'running',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = auth.uid(),
      updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.id, j.edital_id, j.current_stage
  into v_job_id, v_edital_id, v_stage;

  if v_job_id is null then
    return;
  end if;

  return query select v_job_id, v_edital_id, v_stage;
end $$;
