-- Patch rápido: parceiros.logo_url + parceiros.priority
-- Use se você rodou um bootstrap antigo e recebeu:
-- ERROR: 42703: column "priority" does not exist
--
-- Supabase → SQL Editor → New query → cole e rode.

alter table public.partners add column if not exists logo_url text null;
alter table public.partners add column if not exists priority int not null default 0;

create index if not exists partners_priority_idx on public.partners (priority);

