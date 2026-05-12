-- BOOTSTRAP (rode uma vez)
-- Este script cria o schema principal do MVP (Time, Parceiros, RBAC base, Preferências/Layout)
-- e adiciona alguns registros de teste para você já visualizar dados na UI.
--
-- Como rodar: Supabase → SQL Editor → New query → cole tudo → Run

-- =========================================
-- Extensões
-- =========================================
create extension if not exists "pgcrypto";

-- =========================================
-- Helper: trigger updated_at
-- =========================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================
-- Stub temporário: has_permission (para permitir criar policies antes do RBAC completo)
-- Ele será sobrescrito mais abaixo pelo RBAC por permissões.
-- =========================================
create or replace function public.has_permission(permission_key text)
returns boolean
language sql stable
as $$
  select true;
$$;

-- =========================================
-- TIME (MVP+)
-- =========================================
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text null,                 -- cargo/função
  area text null,                 -- área/squad
  phone text null,
  linkedin_url text null,
  bio text null,
  skills text[] not null default '{}'::text[],  -- tags (ex.: ['SQL','Power BI'])
  avatar_url text null,           -- URL pública (Supabase Storage)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migração segura (caso a tabela já exista de versões anteriores)
alter table public.team_members add column if not exists role text;
alter table public.team_members add column if not exists area text;
alter table public.team_members add column if not exists phone text;
alter table public.team_members add column if not exists linkedin_url text;
alter table public.team_members add column if not exists bio text;
alter table public.team_members add column if not exists skills text[] not null default '{}'::text[];
alter table public.team_members add column if not exists avatar_url text;
alter table public.team_members add column if not exists active boolean not null default true;
alter table public.team_members add column if not exists created_at timestamptz not null default now();
alter table public.team_members add column if not exists updated_at timestamptz not null default now();

create index if not exists team_members_email_idx on public.team_members (email);
create index if not exists team_members_active_idx on public.team_members (active);

create table if not exists public.team_member_certificates (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members(id) on delete cascade,
  title text not null,
  issuer text null,
  issued_at date null,
  file_path text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists team_member_certificates_member_id_idx
  on public.team_member_certificates (member_id);

alter table public.team_members enable row level security;
alter table public.team_member_certificates enable row level security;

-- Policies (MVP: qualquer usuário autenticado pode gerenciar)
do $$
begin
  -- limpa policies antigas (caso você já tenha rodado versões anteriores)
  if exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='team_members_write_authenticated') then
    drop policy "team_members_write_authenticated" on public.team_members;
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='team_members_select_authenticated') then
    create policy "team_members_select_authenticated"
      on public.team_members
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='team_member_certificates' and policyname='team_member_certificates_select_authenticated'
  ) then
    create policy "team_member_certificates_select_authenticated"
      on public.team_member_certificates
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='team_member_certificates' and policyname='team_member_certificates_write_authenticated'
  ) then
    create policy "team_member_certificates_write_authenticated"
      on public.team_member_certificates
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Storage buckets (avatars + certificados)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars_rw_authenticated') then
    create policy "avatars_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'avatars')
      with check (bucket_id = 'avatars');
  end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='certificates_rw_authenticated') then
    create policy "certificates_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'certificates')
      with check (bucket_id = 'certificates');
  end if;
end $$;

-- Seeds (Time)
insert into public.team_members (name, email, role, area, skills, active)
values
  ('Elias (Demo)', 'elias.demo@texugo.local', 'Gestor', 'Operações', array['Gestão','Planejamento','Negociação'], true),
  ('Ana (Demo)', 'ana.demo@texugo.local', 'Analista', 'Inteligência', array['SQL','Power BI','Editais'], true)
on conflict (email) do nothing;

-- Trigger updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_team_members_updated_at') then
    create trigger tr_team_members_updated_at
      before update on public.team_members
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================================
-- PARCEIROS + PONTOS FOCAIS (sem login externo)
-- =========================================
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text null,
  cnpj text null,
  segment text null,
  website text null,
  notes text null,
  tags text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_name_idx on public.partners (name);
create index if not exists partners_active_idx on public.partners (active);

create table if not exists public.partner_contact_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_focal_points (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  role_id uuid null references public.partner_contact_roles(id) on delete set null,
  name text not null,
  email text null,
  phone text null,
  department text null,
  is_primary boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_focal_points_partner_id_idx
  on public.partner_focal_points (partner_id);

alter table public.partners enable row level security;
alter table public.partner_contact_roles enable row level security;
alter table public.partner_focal_points enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partners' and policyname='partners_select_authenticated') then
    create policy "partners_select_authenticated"
      on public.partners
      for select
      to authenticated
      using (true);
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='partners' and policyname='partners_write_authenticated') then
    drop policy "partners_write_authenticated" on public.partners;
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_contact_roles' and policyname='partner_contact_roles_select_authenticated') then
    create policy "partner_contact_roles_select_authenticated"
      on public.partner_contact_roles
      for select
      to authenticated
      using (true);
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='partner_contact_roles' and policyname='partner_contact_roles_write_authenticated') then
    drop policy "partner_contact_roles_write_authenticated" on public.partner_contact_roles;
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_focal_points' and policyname='partner_focal_points_select_authenticated') then
    create policy "partner_focal_points_select_authenticated"
      on public.partner_focal_points
      for select
      to authenticated
      using (true);
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='partner_focal_points' and policyname='partner_focal_points_write_authenticated') then
    drop policy "partner_focal_points_write_authenticated" on public.partner_focal_points;
  end if;
end $$;

-- Seeds (roles dinâmicas de contato)
insert into public.partner_contact_roles (name, description)
values
  ('AM', 'Account Manager'),
  ('Apoio Técnico', 'Equipe técnica / suporte'),
  ('Contratos', 'Jurídico / contratos')
on conflict (name) do nothing;

-- Seed (parceiro + pontos focais)
do $$
declare
  p_id uuid;
  role_am uuid;
  role_tech uuid;
begin
  select id into role_am from public.partner_contact_roles where name = 'AM';
  select id into role_tech from public.partner_contact_roles where name = 'Apoio Técnico';

  select id into p_id from public.partners where name = 'Parceiro Demo';
  if p_id is null then
    insert into public.partners (name, segment, website, tags, notes)
    values ('Parceiro Demo', 'Fornecedor', 'https://example.com', array['estratégico','demo'], 'Registro de teste para visualização')
    returning id into p_id;
  end if;

  if not exists (select 1 from public.partner_focal_points where partner_id = p_id and email = 'am@parceirodemo.local') then
    insert into public.partner_focal_points (partner_id, role_id, name, email, phone, department, is_primary)
    values (p_id, role_am, 'Marcos (AM)', 'am@parceirodemo.local', '+55 11 99999-0001', 'AM', true);
  end if;

  if not exists (select 1 from public.partner_focal_points where partner_id = p_id and email = 'tech@parceirodemo.local') then
    insert into public.partner_focal_points (partner_id, role_id, name, email, phone, department)
    values (p_id, role_tech, 'Beatriz (Tech)', 'tech@parceirodemo.local', '+55 11 99999-0002', 'Apoio Técnico');
  end if;
end $$;

-- Trigger updated_at parceiros
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_partners_updated_at') then
    create trigger tr_partners_updated_at
      before update on public.partners
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tr_partner_focals_updated_at') then
    create trigger tr_partner_focals_updated_at
      before update on public.partner_focal_points
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================================
-- CATÁLOGO (hierarquia + itens + artigos internos)
-- =========================================
create table if not exists public.partner_catalog_nodes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  parent_id uuid null references public.partner_catalog_nodes(id) on delete cascade,
  name text not null,
  description text null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_catalog_items (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  node_id uuid not null references public.partner_catalog_nodes(id) on delete cascade,
  kind text not null default 'service' check (kind in ('product','service')),
  name text not null,
  description text null,
  image_url text null,
  tags text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_catalog_item_articles (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.partner_catalog_items(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_catalog_nodes enable row level security;
alter table public.partner_catalog_items enable row level security;
alter table public.partner_catalog_item_articles enable row level security;

create index if not exists partner_catalog_nodes_partner_id_idx on public.partner_catalog_nodes (partner_id);
create index if not exists partner_catalog_nodes_parent_id_idx on public.partner_catalog_nodes (parent_id);
create index if not exists partner_catalog_items_partner_id_idx on public.partner_catalog_items (partner_id);
create index if not exists partner_catalog_items_node_id_idx on public.partner_catalog_items (node_id);
create index if not exists partner_catalog_item_articles_item_id_idx on public.partner_catalog_item_articles (item_id);

-- triggers updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_partner_catalog_nodes_updated_at') then
    create trigger tr_partner_catalog_nodes_updated_at
      before update on public.partner_catalog_nodes
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tr_partner_catalog_items_updated_at') then
    create trigger tr_partner_catalog_items_updated_at
      before update on public.partner_catalog_items
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tr_partner_catalog_item_articles_updated_at') then
    create trigger tr_partner_catalog_item_articles_updated_at
      before update on public.partner_catalog_item_articles
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Storage bucket para imagens do catálogo
insert into storage.buckets (id, name, public)
values ('partner-assets', 'partner-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='partner_assets_rw_authenticated') then
    create policy "partner_assets_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'partner-assets')
      with check (bucket_id = 'partner-assets');
  end if;
end $$;

-- Seeds catálogo (para Parceiro Demo)
do $$
declare
  p_id uuid;
  root_id uuid;
  sub_id uuid;
  v_item_id uuid;
begin
  select id into p_id from public.partners where name='Parceiro Demo' limit 1;
  if p_id is null then return; end if;

  select id into root_id from public.partner_catalog_nodes where partner_id=p_id and parent_id is null and name='Serviços' limit 1;
  if root_id is null then
    insert into public.partner_catalog_nodes (partner_id, name, description, sort_order)
    values (p_id, 'Serviços', 'Categorias de serviços do parceiro', 0)
    returning id into root_id;
  end if;

  select id into sub_id from public.partner_catalog_nodes where partner_id=p_id and parent_id=root_id and name='Contratos' limit 1;
  if sub_id is null then
    insert into public.partner_catalog_nodes (partner_id, parent_id, name, description, sort_order)
    values (p_id, root_id, 'Contratos', 'Suporte jurídico e gestão de contratos', 0)
    returning id into sub_id;
  end if;

  select id into v_item_id from public.partner_catalog_items where partner_id=p_id and node_id=sub_id and name='Análise de Contratos (Demo)' limit 1;
  if v_item_id is null then
    insert into public.partner_catalog_items (partner_id, node_id, kind, name, description, tags)
    values (p_id, sub_id, 'service', 'Análise de Contratos (Demo)', 'Revisão e parecer de contratos', array['jurídico','compliance'])
    returning id into v_item_id;
  end if;

  if not exists (
    select 1
    from public.partner_catalog_item_articles a
    where a.item_id = v_item_id and a.title='Como acionar (Demo)'
  ) then
    insert into public.partner_catalog_item_articles (item_id, title, content)
    values (v_item_id, 'Como acionar (Demo)', 'Passo a passo:\n1) Enviar contrato\n2) Informar prazo\n3) Receber parecer\n\nObservação: artigo interno de exemplo.');
  end if;
end $$;

-- =========================================
-- PROCESSOS (Macro/Micro + 5W2H + anexos versionados + KPIs)
-- =========================================
create table if not exists public.process_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  area_id uuid null references public.process_areas(id) on delete set null,
  parent_id uuid null references public.processes(id) on delete cascade,
  code text null,
  name text not null,
  macro_summary text null,
  macro_kpis_summary text null,
  micro_description text null,
  what text null,
  why text null,
  where_ text null,
  who text null,
  when_ text null,
  how text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists processes_area_id_idx on public.processes (area_id);
create index if not exists processes_parent_id_idx on public.processes (parent_id);

create table if not exists public.process_kpis (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  name text not null,
  unit text null,
  direction text not null default 'higher_is_better' check (direction in ('higher_is_better','lower_is_better')),
  target numeric null,
  warning_threshold numeric null,
  critical_threshold numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.process_kpi_values (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.process_kpis(id) on delete cascade,
  date date not null,
  value numeric not null,
  notes text null,
  created_at timestamptz not null default now(),
  unique(kpi_id, date)
);

create table if not exists public.process_files (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  kind text not null check (kind in ('bpmn','dep','raci','other')),
  filename text not null,
  mime_type text null,
  file_path text not null,
  file_url text not null,
  version int not null default 1,
  is_current boolean not null default true,
  uploaded_by uuid null,
  uploaded_at timestamptz not null default now(),
  notes text null
);

create index if not exists process_kpis_process_id_idx on public.process_kpis (process_id);
create index if not exists process_kpi_values_kpi_id_idx on public.process_kpi_values (kpi_id);
create index if not exists process_files_process_id_idx on public.process_files (process_id);
create index if not exists process_files_kind_idx on public.process_files (kind);

alter table public.process_areas enable row level security;
alter table public.processes enable row level security;
alter table public.process_kpis enable row level security;
alter table public.process_kpi_values enable row level security;
alter table public.process_files enable row level security;

-- triggers updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_processes_updated_at') then
    create trigger tr_processes_updated_at
      before update on public.processes
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'tr_process_kpis_updated_at') then
    create trigger tr_process_kpis_updated_at
      before update on public.process_kpis
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Storage bucket para anexos
insert into storage.buckets (id, name, public)
values ('process-assets', 'process-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='process_assets_rw_authenticated') then
    create policy "process_assets_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'process-assets')
      with check (bucket_id = 'process-assets');
  end if;
end $$;

-- Seeds processos
insert into public.process_areas (name, description)
values
  ('Operações', 'Processos operacionais'),
  ('Jurídico', 'Processos jurídicos e contratos')
on conflict (name) do nothing;

do $$
declare
  ops_id uuid;
  root_id uuid;
  sub_id uuid;
  v_kpi_id uuid;
begin
  select id into ops_id from public.process_areas where name='Operações' limit 1;

  select id into root_id from public.processes where parent_id is null and name='Macroprocesso (Demo)' limit 1;
  if root_id is null then
    insert into public.processes (area_id, name, macro_summary)
    values (ops_id, 'Macroprocesso (Demo)', 'Mapa geral (demo).')
    returning id into root_id;
  end if;

  select id into sub_id from public.processes where parent_id=root_id and name='Processo (Demo)' limit 1;
  if sub_id is null then
    insert into public.processes (area_id, parent_id, name, micro_description, what, why, where_, who, when_, how)
    values (ops_id, root_id, 'Processo (Demo)', 'Descrição detalhada (demo).', 'O que é', 'Por que existe', 'Onde', 'Quem (RACI)', 'Quando', 'Como')
    returning id into sub_id;
  end if;

  select id into v_kpi_id from public.process_kpis where process_id=sub_id and name='SLA (dias)' limit 1;
  if v_kpi_id is null then
    insert into public.process_kpis (process_id, name, unit, direction, target, warning_threshold, critical_threshold)
    values (sub_id, 'SLA (dias)', 'dias', 'lower_is_better', 5, 7, 10)
    returning id into v_kpi_id;
  end if;

  insert into public.process_kpi_values (kpi_id, date, value)
  values (v_kpi_id, current_date - 14, 8),
         (v_kpi_id, current_date - 7, 6),
         (v_kpi_id, current_date, 4)
  on conflict (kpi_id, date) do nothing;
end $$;

-- =========================================
-- ORGANOGRAMA (posições + subordinação)
-- =========================================
create table if not exists public.org_positions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  user_id uuid primary key,
  email text not null,
  name text null,
  position_id uuid null references public.org_positions(id) on delete set null,
  manager_user_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_positions enable row level security;
alter table public.org_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tr_org_members_updated_at') then
    create trigger tr_org_members_updated_at
      before update on public.org_members
      for each row execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_positions' and policyname='org_positions_select_authenticated') then
    create policy "org_positions_select_authenticated"
      on public.org_positions
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_positions' and policyname='org_positions_write_permission') then
    create policy "org_positions_write_permission"
      on public.org_positions
      for all
      to authenticated
      using (public.has_permission('time.manage'))
      with check (public.has_permission('time.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_members' and policyname='org_members_select_authenticated') then
    create policy "org_members_select_authenticated"
      on public.org_members
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_members' and policyname='org_members_write_permission') then
    create policy "org_members_write_permission"
      on public.org_members
      for all
      to authenticated
      using (public.has_permission('time.manage'))
      with check (public.has_permission('time.manage'));
  end if;
end $$;

create or replace function public.user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
begin
  if not public.has_permission('time.manage') then
    raise exception 'Sem permissão: time.manage';
  end if;
  select id into uid
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;
  return uid;
end $$;

-- Seeds organograma (opcional): cadastra o último usuário criado como "Diretoria" sem gestor
do $$
declare
  u_id uuid;
  pos_id uuid;
begin
  insert into public.org_positions (key, name, description)
  values ('diretoria', 'Diretoria', 'Topo do organograma (demo)')
  on conflict (key) do nothing;
  select id into pos_id from public.org_positions where key='diretoria' limit 1;

  select id into u_id from auth.users order by created_at desc limit 1;
  if u_id is null then return; end if;
  insert into public.org_members (user_id, email, position_id, manager_user_id)
  select u_id, email, pos_id, null
  from auth.users
  where id = u_id
  on conflict (user_id) do nothing;
end $$;

-- =========================================
-- RBAC BASE (preparação para Processos + futuro AD)
-- =========================================
create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null references public.app_roles(id) on delete cascade,
  scope_partner_id uuid null references public.partners(id) on delete cascade,
  scope_area text null,
  created_at timestamptz not null default now(),
  unique(user_id, role_id, scope_partner_id, scope_area)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);

alter table public.app_roles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(role_key text, partner_id uuid default null)
returns boolean
language sql stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.app_roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.key = role_key
      and (partner_id is null or ur.scope_partner_id = partner_id)
  );
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_roles' and policyname='app_roles_select_authenticated') then
    create policy "app_roles_select_authenticated"
      on public.app_roles
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_roles' and policyname='app_roles_write_admin') then
    create policy "app_roles_write_admin"
      on public.app_roles
      for all
      to authenticated
      using (public.has_role('admin'))
      with check (public.has_role('admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles_select_authenticated') then
    create policy "user_roles_select_authenticated"
      on public.user_roles
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles_write_admin') then
    create policy "user_roles_write_admin"
      on public.user_roles
      for all
      to authenticated
      using (public.has_role('admin'))
      with check (public.has_role('admin'));
  end if;
end $$;

insert into public.app_roles (key, name, description)
values
  ('admin', 'Admin', 'Acesso total'),
  ('colaborador', 'Colaborador', 'Acesso padrão'),
  ('contratos', 'Contratos', 'Visão e ações de contratos'),
  ('apoio-tecnico', 'Apoio Técnico', 'Visão técnica/apoio')
on conflict (key) do nothing;

-- =========================================
-- PERMISSÕES (RBAC por capability)
-- =========================================
create table if not exists public.app_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.app_roles(id) on delete cascade,
  permission_id uuid not null references public.app_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(role_id, permission_id)
);

alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;

create or replace function public.has_permission(permission_key text)
returns boolean
language plpgsql stable
as $$
declare
  has_org boolean;
begin
  has_org := to_regclass('public.org_members') is not null;

  if not has_org then
    return exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.app_permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and p.key = permission_key
    );
  end if;

  return exists (
    with recursive scope_users as (
      select auth.uid() as user_id
      union all
      select om.user_id
      from public.org_members om
      join scope_users su on om.manager_user_id = su.user_id
    )
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.app_permissions p on p.id = rp.permission_id
    where ur.user_id in (select user_id from scope_users)
      and p.key = permission_key
    limit 1
  );
end $$;

-- Policies para permissões
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_permissions' and policyname='app_permissions_select_authenticated') then
    create policy "app_permissions_select_authenticated"
      on public.app_permissions
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_permissions' and policyname='app_permissions_write_admin') then
    create policy "app_permissions_write_admin"
      on public.app_permissions
      for all
      to authenticated
      using (public.has_role('admin'))
      with check (public.has_role('admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='role_permissions' and policyname='role_permissions_select_authenticated') then
    create policy "role_permissions_select_authenticated"
      on public.role_permissions
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='role_permissions' and policyname='role_permissions_write_admin') then
    create policy "role_permissions_write_admin"
      on public.role_permissions
      for all
      to authenticated
      using (public.has_role('admin'))
      with check (public.has_role('admin'));
  end if;
end $$;

-- Seeds permissões
insert into public.app_permissions (key, name, description)
values
  ('time.manage', 'Gerir Time', 'Criar/editar membros, funções e organograma'),
  ('partners.manage', 'Gerir Parceiros', 'Criar/editar parceiros, pontos focais e funções'),
  ('catalog.manage', 'Gerir Catálogo', 'Criar/editar catálogo de produtos/serviços'),
  ('process.view', 'Ver Processos', 'Visualizar processos e detalhes'),
  ('process.manage', 'Gerir Processos', 'Criar/editar processos, anexos e KPIs'),
  ('reports.generate', 'Gerar Relatórios', 'Gerar e baixar relatórios mensais'),
  ('rbac.manage', 'Gerir RBAC', 'Gerir papéis e permissões')
on conflict (key) do nothing;

-- Concede todas as permissões ao admin
do $$
declare
  admin_role_id uuid;
begin
  select id into admin_role_id from public.app_roles where key='admin';
  if admin_role_id is null then return; end if;
  insert into public.role_permissions (role_id, permission_id)
  select admin_role_id, p.id from public.app_permissions p
  on conflict (role_id, permission_id) do nothing;
end $$;

-- Atribui admin automaticamente ao primeiro usuário (ou ao email do print)
do $$
declare
  u_id uuid;
  admin_role_id uuid;
begin
  select id into admin_role_id from public.app_roles where key='admin';
  if admin_role_id is null then return; end if;

  select id into u_id from auth.users where email = 'texugoestrategia@gmail.com' limit 1;
  if u_id is null then
    select id into u_id from auth.users order by created_at desc limit 1;
  end if;
  if u_id is null then return; end if;

  insert into public.user_roles(user_id, role_id)
  values (u_id, admin_role_id)
  on conflict do nothing;
end $$;

-- Policies finais (escrita por permissão)
do $$
begin
  -- Team: escrever apenas com permissão time.manage
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='team_members_write_permission') then
    create policy "team_members_write_permission"
      on public.team_members
      for all
      to authenticated
      using (public.has_permission('time.manage'))
      with check (public.has_permission('time.manage'));
  end if;

  -- Parceiros: escrever com partners.manage
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partners' and policyname='partners_write_permission') then
    create policy "partners_write_permission"
      on public.partners
      for all
      to authenticated
      using (public.has_permission('partners.manage'))
      with check (public.has_permission('partners.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_contact_roles' and policyname='partner_contact_roles_write_permission') then
    create policy "partner_contact_roles_write_permission"
      on public.partner_contact_roles
      for all
      to authenticated
      using (public.has_permission('partners.manage'))
      with check (public.has_permission('partners.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_focal_points' and policyname='partner_focal_points_write_permission') then
    create policy "partner_focal_points_write_permission"
      on public.partner_focal_points
      for all
      to authenticated
      using (public.has_permission('partners.manage'))
      with check (public.has_permission('partners.manage'));
  end if;

  -- Catálogo: ler para authenticated, escrever com catalog.manage
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_nodes' and policyname='partner_catalog_nodes_select_authenticated') then
    create policy "partner_catalog_nodes_select_authenticated"
      on public.partner_catalog_nodes
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_nodes' and policyname='partner_catalog_nodes_write_permission') then
    create policy "partner_catalog_nodes_write_permission"
      on public.partner_catalog_nodes
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_items' and policyname='partner_catalog_items_select_authenticated') then
    create policy "partner_catalog_items_select_authenticated"
      on public.partner_catalog_items
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_items' and policyname='partner_catalog_items_write_permission') then
    create policy "partner_catalog_items_write_permission"
      on public.partner_catalog_items
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_item_articles' and policyname='partner_catalog_item_articles_select_authenticated') then
    create policy "partner_catalog_item_articles_select_authenticated"
      on public.partner_catalog_item_articles
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_item_articles' and policyname='partner_catalog_item_articles_write_permission') then
    create policy "partner_catalog_item_articles_write_permission"
      on public.partner_catalog_item_articles
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));
  end if;

  -- Processos: ler com process.view (ou process.manage), escrever com process.manage
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_areas' and policyname='process_areas_select_permission') then
    create policy "process_areas_select_permission"
      on public.process_areas
      for select
      to authenticated
      using (public.has_permission('process.view') or public.has_permission('process.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_areas' and policyname='process_areas_write_permission') then
    create policy "process_areas_write_permission"
      on public.process_areas
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='processes' and policyname='processes_select_permission') then
    create policy "processes_select_permission"
      on public.processes
      for select
      to authenticated
      using (public.has_permission('process.view') or public.has_permission('process.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='processes' and policyname='processes_write_permission') then
    create policy "processes_write_permission"
      on public.processes
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_files' and policyname='process_files_select_permission') then
    create policy "process_files_select_permission"
      on public.process_files
      for select
      to authenticated
      using (public.has_permission('process.view') or public.has_permission('process.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_files' and policyname='process_files_write_permission') then
    create policy "process_files_write_permission"
      on public.process_files
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_kpis' and policyname='process_kpis_select_permission') then
    create policy "process_kpis_select_permission"
      on public.process_kpis
      for select
      to authenticated
      using (public.has_permission('process.view') or public.has_permission('process.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_kpis' and policyname='process_kpis_write_permission') then
    create policy "process_kpis_write_permission"
      on public.process_kpis
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_kpi_values' and policyname='process_kpi_values_select_permission') then
    create policy "process_kpi_values_select_permission"
      on public.process_kpi_values
      for select
      to authenticated
      using (public.has_permission('process.view') or public.has_permission('process.manage'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_kpi_values' and policyname='process_kpi_values_write_permission') then
    create policy "process_kpi_values_write_permission"
      on public.process_kpi_values
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));
  end if;
end $$;

-- Obs: não dá para atribuir admin automaticamente aqui sem saber seu user_id.
-- Para promover seu usuário a admin:
-- 1) select id, email from auth.users order by created_at desc;
-- 2) select id from public.app_roles where key='admin';
-- 3) insert into public.user_roles(user_id, role_id) values ('<user_id>', '<admin_role_id>');

-- =========================================
-- PREFERÊNCIAS DO USUÁRIO (Aparência + Layout / Drag & Drop)
-- =========================================
create table if not exists public.user_preferences (
  user_id uuid primary key,
  theme_mode text not null default 'dark' check (theme_mode in ('light','dark','system')),
  accent text not null default 'emerald',
  accent_custom_hsl text null,
  bg_type text not null default 'solid' check (bg_type in ('solid','image')),
  bg_color text null,
  bg_image_url text null,
  font_scale numeric not null default 1.0 check (font_scale >= 0.9 and font_scale <= 1.1),
  dense_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_preferences add column if not exists accent_custom_hsl text;

alter table public.user_preferences enable row level security;

create table if not exists public.user_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, key)
);

create index if not exists user_layouts_user_id_idx on public.user_layouts (user_id);
alter table public.user_layouts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_preferences' and policyname='user_preferences_owner') then
    create policy "user_preferences_owner"
      on public.user_preferences
      for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_layouts' and policyname='user_layouts_owner') then
    create policy "user_layouts_owner"
      on public.user_layouts
      for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Storage bucket (backgrounds)
insert into storage.buckets (id, name, public)
values ('backgrounds', 'backgrounds', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='backgrounds_rw_authenticated') then
    create policy "backgrounds_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'backgrounds')
      with check (bucket_id = 'backgrounds');
  end if;
end $$;

-- =========================================
-- RELATÓRIOS (histórico + bucket)
-- =========================================
create table if not exists public.partner_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  file_path text not null,
  file_url text not null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique(month)
);

alter table public.partner_monthly_reports enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_monthly_reports' and policyname='partner_monthly_reports_select_authenticated') then
    create policy "partner_monthly_reports_select_authenticated"
      on public.partner_monthly_reports
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_monthly_reports' and policyname='partner_monthly_reports_write_permission') then
    create policy "partner_monthly_reports_write_permission"
      on public.partner_monthly_reports
      for all
      to authenticated
      using (public.has_permission('reports.generate'))
      with check (public.has_permission('reports.generate'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='reports_rw_authenticated') then
    create policy "reports_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'reports')
      with check (bucket_id = 'reports');
  end if;
end $$;

-- Fim do bootstrap
