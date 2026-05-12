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
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='team_members' and policyname='team_members_select_authenticated'
  ) then
    create policy "team_members_select_authenticated"
      on public.team_members
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='team_members' and policyname='team_members_write_authenticated'
  ) then
    create policy "team_members_write_authenticated"
      on public.team_members
      for all
      to authenticated
      using (true)
      with check (true);
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
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partners' and policyname='partners_write_authenticated') then
    create policy "partners_write_authenticated"
      on public.partners
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

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
  bg_type text not null default 'solid' check (bg_type in ('solid','image')),
  bg_color text null,
  bg_image_url text null,
  font_scale numeric not null default 1.0 check (font_scale >= 0.9 and font_scale <= 1.1),
  dense_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

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

-- Fim do bootstrap

