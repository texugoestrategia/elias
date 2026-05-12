-- Organograma (funções/posições + subordinação) + helper de lookup de user_id por email
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.org_positions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,  -- ex.: 'gestor-operacoes'
  name text not null,
  description text null,
  created_at timestamptz not null default now()
);

-- Relação de subordinação: usuário -> gestor
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

-- Trigger updated_at (se existir a função do bootstrap)
do $$
begin
  if exists(select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'tr_org_members_updated_at') then
      create trigger tr_org_members_updated_at
        before update on public.org_members
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- Policies: leitura para authenticated; escrita com permissão time.manage (se existir has_permission)
do $$
declare
  has_perm boolean;
begin
  select exists(select 1 from pg_proc where proname='has_permission') into has_perm;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_positions' and policyname='org_positions_select_authenticated') then
    create policy "org_positions_select_authenticated"
      on public.org_positions
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_positions' and policyname='org_positions_write') then
    create policy "org_positions_write"
      on public.org_positions
      for all
      to authenticated
      using (case when has_perm then public.has_permission('time.manage') else true end)
      with check (case when has_perm then public.has_permission('time.manage') else true end);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_members' and policyname='org_members_select_authenticated') then
    create policy "org_members_select_authenticated"
      on public.org_members
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='org_members' and policyname='org_members_write') then
    create policy "org_members_write"
      on public.org_members
      for all
      to authenticated
      using (case when has_perm then public.has_permission('time.manage') else true end)
      with check (case when has_perm then public.has_permission('time.manage') else true end);
  end if;
end $$;

-- Função auxiliar: pegar user_id pelo email (para uso no app).
-- Restrição: exige permissão time.manage.
create or replace function public.user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
begin
  if exists(select 1 from pg_proc where proname='has_permission') then
    if not public.has_permission('time.manage') then
      raise exception 'Sem permissão: time.manage';
    end if;
  end if;

  select id into uid
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  return uid;
end $$;

