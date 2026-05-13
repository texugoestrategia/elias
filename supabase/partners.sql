-- Parceiros + Pontos focais (somente contatos, sem login externo)
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Parceiros
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text null,
  cnpj text null,
  segment text null,
  website text null,
  logo_url text null,
  priority int not null default 0,
  notes text null,
  tags text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_name_idx on public.partners (name);
create index if not exists partners_active_idx on public.partners (active);
create index if not exists partners_priority_idx on public.partners (priority);

-- Catálogo de funções de ponto focal (dinâmico)
create table if not exists public.partner_contact_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- ex.: AM, Apoio Técnico, Contratos
  description text null,
  created_at timestamptz not null default now()
);

-- Pontos focais (contatos)
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

-- Materiais de divulgação do parceiro (PDFs, apresentações, one-pagers, etc.)
create table if not exists public.partner_marketing_materials (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  title text not null,
  type text not null default 'general' check (type in ('general','deck','one_pager','case','datasheet','video','link')),
  storage_path text null,
  public_url text null,
  notes text null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_marketing_materials_partner_id_idx
  on public.partner_marketing_materials (partner_id);

-- RLS
alter table public.partners enable row level security;
alter table public.partner_contact_roles enable row level security;
alter table public.partner_focal_points enable row level security;
alter table public.partner_marketing_materials enable row level security;

-- Policies (MVP: colaboradores autenticados podem ler/editar)
do $$
begin
  -- partners
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partners' and policyname='partners_select_authenticated') then
    create policy "partners_select_authenticated"
      on public.partners
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partners' and policyname='partners_write_authenticated') then
    create policy "partners_write_authenticated"
      on public.partners
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  -- partner_contact_roles
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_contact_roles' and policyname='partner_contact_roles_select_authenticated') then
    create policy "partner_contact_roles_select_authenticated"
      on public.partner_contact_roles
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_contact_roles' and policyname='partner_contact_roles_write_authenticated') then
    create policy "partner_contact_roles_write_authenticated"
      on public.partner_contact_roles
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  -- partner_focal_points
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_focal_points' and policyname='partner_focal_points_select_authenticated') then
    create policy "partner_focal_points_select_authenticated"
      on public.partner_focal_points
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_focal_points' and policyname='partner_focal_points_write_authenticated') then
    create policy "partner_focal_points_write_authenticated"
      on public.partner_focal_points
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  -- partner_marketing_materials
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_marketing_materials' and policyname='partner_marketing_materials_select_authenticated') then
    create policy "partner_marketing_materials_select_authenticated"
      on public.partner_marketing_materials
      for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_marketing_materials' and policyname='partner_marketing_materials_write_authenticated') then
    create policy "partner_marketing_materials_write_authenticated"
      on public.partner_marketing_materials
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Storage bucket para logos e materiais de divulgação
-- (Se já existir via partners_catalog.sql, este bloco é idempotente)
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
