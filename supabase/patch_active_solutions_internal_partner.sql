-- Patch: cria/identifica a empresa interna "Active Solutions" como um parceiro interno
-- e adiciona colunas auxiliares para suportar catálogo interno.
--
-- Rode no Supabase → SQL Editor.

begin;

alter table public.partners add column if not exists key text null;
alter table public.partners add column if not exists is_internal boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partners_key_unique'
  ) then
    alter table public.partners
      add constraint partners_key_unique unique (key);
  end if;
end $$;

-- garante o parceiro interno
insert into public.partners (key, name, is_internal, priority, active)
values ('active_solutions', 'Active Solutions', true, 100, true)
on conflict (key) do update
set name = excluded.name,
    is_internal = true;

commit;

