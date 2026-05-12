-- Processos organizacionais (Macro/Micro) + Arquivos versionados + KPIs
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Áreas (para visão gerencial / consolidação)
create table if not exists public.process_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text null,
  created_at timestamptz not null default now()
);

-- Processos (hierarquia via parent_id)
create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  area_id uuid null references public.process_areas(id) on delete set null,
  parent_id uuid null references public.processes(id) on delete cascade,
  code text null,
  name text not null,

  -- Macro
  macro_summary text null,
  macro_kpis_summary text null,

  -- Micro (detalhado)
  micro_description text null,

  -- 5W2H (opcionais)
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

-- KPIs (definição)
create table if not exists public.process_kpis (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes(id) on delete cascade,
  name text not null,
  unit text null, -- ex.: %, dias, R$
  direction text not null default 'higher_is_better' check (direction in ('higher_is_better','lower_is_better')),
  target numeric null,
  warning_threshold numeric null,
  critical_threshold numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists process_kpis_process_id_idx on public.process_kpis (process_id);

-- KPI values (histórico)
create table if not exists public.process_kpi_values (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.process_kpis(id) on delete cascade,
  date date not null,
  value numeric not null,
  notes text null,
  created_at timestamptz not null default now(),
  unique(kpi_id, date)
);

create index if not exists process_kpi_values_kpi_id_idx on public.process_kpi_values (kpi_id);

-- Arquivos por processo (BPMN/DEP/RACI etc) com versionamento
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
  uploaded_by uuid null, -- auth.users.id
  uploaded_at timestamptz not null default now(),
  notes text null
);

create index if not exists process_files_process_id_idx on public.process_files (process_id);
create index if not exists process_files_kind_idx on public.process_files (kind);

-- RLS
alter table public.process_areas enable row level security;
alter table public.processes enable row level security;
alter table public.process_kpis enable row level security;
alter table public.process_kpi_values enable row level security;
alter table public.process_files enable row level security;

-- Policies (se RBAC por permissão estiver instalado, usa has_permission; senão libera para authenticated)
do $$
declare
  has_perm boolean;
begin
  select exists(select 1 from pg_proc where proname = 'has_permission') into has_perm;

  drop policy if exists "process_areas_write" on public.process_areas;
  drop policy if exists "processes_write" on public.processes;
  drop policy if exists "process_files_write" on public.process_files;
  drop policy if exists "process_kpis_write" on public.process_kpis;
  drop policy if exists "process_kpi_values_write" on public.process_kpi_values;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_areas' and policyname='process_areas_select') then
    create policy "process_areas_select"
      on public.process_areas
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='processes' and policyname='processes_select') then
    create policy "processes_select"
      on public.processes
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_files' and policyname='process_files_select') then
    create policy "process_files_select"
      on public.process_files
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_kpis' and policyname='process_kpis_select') then
    create policy "process_kpis_select"
      on public.process_kpis
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='process_kpi_values' and policyname='process_kpi_values_select') then
    create policy "process_kpi_values_select"
      on public.process_kpi_values
      for select
      to authenticated
      using (true);
  end if;

  if has_perm then
    create policy "process_areas_write"
      on public.process_areas
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));

    create policy "processes_write"
      on public.processes
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));

    create policy "process_files_write"
      on public.process_files
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));

    create policy "process_kpis_write"
      on public.process_kpis
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));

    create policy "process_kpi_values_write"
      on public.process_kpi_values
      for all
      to authenticated
      using (public.has_permission('process.manage'))
      with check (public.has_permission('process.manage'));
  else
    create policy "process_areas_write"
      on public.process_areas
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "processes_write"
      on public.processes
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "process_files_write"
      on public.process_files
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "process_kpis_write"
      on public.process_kpis
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "process_kpi_values_write"
      on public.process_kpi_values
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Storage bucket para anexos de processos (até 20MB por arquivo: limitar no app)
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
