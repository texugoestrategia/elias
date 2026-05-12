-- Diretório de usuários (AD-ready, read-only) + organograma por usuário
-- Este modelo permite cadastrar/organizar pessoas antes do 1º login, usando email como chave.
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.directory_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text null,
  active boolean not null default true,
  position_id uuid null references public.org_positions(id) on delete set null,
  manager_id uuid null references public.directory_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists directory_users_manager_id_idx on public.directory_users(manager_id);

-- Vínculo auth.uid -> directory_user (feito automaticamente no login pelo app, sem mexer no AD)
create table if not exists public.directory_auth_links (
  auth_user_id uuid primary key,
  directory_user_id uuid not null references public.directory_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Roles por usuário (pode ser configurado antes do login)
create table if not exists public.directory_user_roles (
  id uuid primary key default gen_random_uuid(),
  directory_user_id uuid not null references public.directory_users(id) on delete cascade,
  role_id uuid not null references public.app_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(directory_user_id, role_id)
);

alter table public.directory_users enable row level security;
alter table public.directory_auth_links enable row level security;
alter table public.directory_user_roles enable row level security;

-- Policies: leitura para authenticated; escrita com permissão time.manage
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='directory_users' and policyname='directory_users_select_authenticated') then
    create policy "directory_users_select_authenticated"
      on public.directory_users
      for select
      to authenticated
      using (true);
  end if;
  drop policy if exists "directory_users_write_permission" on public.directory_users;
  create policy "directory_users_write_permission"
    on public.directory_users
    for all
    to authenticated
    using (public.has_permission('time.manage'))
    with check (public.has_permission('time.manage'));

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='directory_auth_links' and policyname='directory_auth_links_select_authenticated') then
    create policy "directory_auth_links_select_authenticated"
      on public.directory_auth_links
      for select
      to authenticated
      using (true);
  end if;
  drop policy if exists "directory_auth_links_write_permission" on public.directory_auth_links;
  create policy "directory_auth_links_write_permission"
    on public.directory_auth_links
    for all
    to authenticated
    using (public.has_permission('time.manage'))
    with check (public.has_permission('time.manage'));

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='directory_user_roles' and policyname='directory_user_roles_select_authenticated') then
    create policy "directory_user_roles_select_authenticated"
      on public.directory_user_roles
      for select
      to authenticated
      using (true);
  end if;
  drop policy if exists "directory_user_roles_write_permission" on public.directory_user_roles;
  create policy "directory_user_roles_write_permission"
    on public.directory_user_roles
    for all
    to authenticated
    using (public.has_permission('time.manage'))
    with check (public.has_permission('time.manage'));
end $$;

-- Trigger updated_at (se existir)
do $$
begin
  if exists(select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'tr_directory_users_updated_at') then
      create trigger tr_directory_users_updated_at
        before update on public.directory_users
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

