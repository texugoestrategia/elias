-- Módulo Time (MVP+)
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

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

-- Certificados / anexos do Time
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

-- Policies (MVP: qualquer usuário autenticado pode gerenciar o time)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname = 'team_members_select_authenticated'
  ) then
    create policy "team_members_select_authenticated"
      on public.team_members
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname = 'team_members_write_authenticated'
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
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_member_certificates'
      and policyname = 'team_member_certificates_select_authenticated'
  ) then
    create policy "team_member_certificates_select_authenticated"
      on public.team_member_certificates
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_member_certificates'
      and policyname = 'team_member_certificates_write_authenticated'
  ) then
    create policy "team_member_certificates_write_authenticated"
      on public.team_member_certificates
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Storage (avatars + certificados)
-- Obs: para buckets e policies de Storage, rodar este trecho também.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

-- Policies em storage.objects (RLS) para permitir upload/leitura por usuários autenticados
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
