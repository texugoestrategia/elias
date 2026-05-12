-- RBAC base (dinâmico) - preparado para mapear grupos do AD no futuro
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Catálogo de papéis/roles do app (dinâmico)
create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,         -- ex.: 'admin', 'gestor', 'colaborador', 'contratos'
  name text not null,               -- nome legível
  description text null,
  created_at timestamptz not null default now()
);

-- Vínculo usuário (Supabase Auth) → roles (com escopo opcional)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,            -- auth.users.id
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

-- helper: checa se usuário tem role (com escopo opcional)
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

-- Policies (MVP: authenticated pode ler; somente admin pode escrever catálogo de roles e atribuições)
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

-- Seeds mínimos (pode ajustar depois)
insert into public.app_roles (key, name, description)
values
  ('admin', 'Admin', 'Acesso total'),
  ('colaborador', 'Colaborador', 'Acesso padrão')
on conflict (key) do nothing;

-- Como tornar seu usuário admin:
-- 1) Descubra seu user_id:
--    select id, email from auth.users order by created_at desc;
-- 2) Pegue o role_id do admin:
--    select id, key from public.app_roles;
-- 3) Insira:
--    insert into public.user_roles(user_id, role_id) values ('<user_id>', '<admin_role_id>');

