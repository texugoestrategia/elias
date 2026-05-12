-- Relatórios (parceiros) - histórico
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.partner_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  month text not null, -- YYYY-MM
  file_path text not null,
  file_url text not null,
  created_by uuid null, -- auth.users.id
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
end $$;

-- Storage bucket (reports)
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

