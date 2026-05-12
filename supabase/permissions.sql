-- RBAC por permissões (dinâmico)
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.app_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,   -- ex.: 'partners.manage'
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

create index if not exists role_permissions_role_id_idx on public.role_permissions (role_id);

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

-- Policies: ler permissões para usuários autenticados; escrever só admin
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

-- Seeds: permissões do sistema (ajuste livre)
insert into public.app_permissions (key, name, description)
values
  ('time.manage', 'Gerir Time', 'Criar/editar membros, funções e organograma'),
  ('partners.manage', 'Gerir Parceiros', 'Criar/editar parceiros, pontos focais e funções'),
  ('catalog.manage', 'Gerir Catálogo', 'Criar/editar catálogo de produtos/serviços de parceiros'),
  ('process.view', 'Ver Processos', 'Visualizar processos e detalhes'),
  ('process.manage', 'Gerir Processos', 'Criar/editar processos, anexos e KPIs'),
  ('editais.manage', 'Gerir Editais', 'Subir lotes, acompanhar pipeline e corrigir exceções'),
  ('editais.rules.manage', 'Gerir Regras de Editais', 'Criar/versionar regras de elegibilidade e pontuação'),
  ('reports.generate', 'Gerar Relatórios', 'Gerar e baixar relatórios mensais'),
  ('rbac.manage', 'Gerir RBAC', 'Gerir papéis e permissões')
on conflict (key) do nothing;

-- Conceder todas as permissões ao role 'admin' (se existir)
do $$
declare
  admin_role_id uuid;
begin
  select id into admin_role_id from public.app_roles where key='admin';
  if admin_role_id is null then
    return;
  end if;

  insert into public.role_permissions (role_id, permission_id)
  select admin_role_id, p.id
  from public.app_permissions p
  on conflict (role_id, permission_id) do nothing;
end $$;
