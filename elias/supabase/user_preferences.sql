-- Preferências por usuário (Aparência + Layout)
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Preferências de aparência (limitadas para não quebrar UX)
create table if not exists public.user_preferences (
  user_id uuid primary key, -- auth.users.id
  theme_mode text not null default 'dark' check (theme_mode in ('light','dark','system')),
  accent text not null default 'emerald', -- chave de cor (paleta controlada no app) ou 'custom'
  accent_custom_hsl text null, -- ex.: "210 80% 56%" (quando accent='custom')
  bg_type text not null default 'solid' check (bg_type in ('solid','image')),
  bg_color text null,       -- ex.: '#0b0b0f' (usado se bg_type=solid)
  bg_image_url text null,   -- URL pública (Supabase Storage)
  font_scale numeric not null default 1.0 check (font_scale >= 0.9 and font_scale <= 1.1),
  dense_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_preferences add column if not exists accent_custom_hsl text;

alter table public.user_preferences enable row level security;

-- Layouts personalizados (drag & drop). Ex.: sidebar, dashboard.widgets, etc.
create table if not exists public.user_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  key text not null,        -- ex.: 'sidebar', 'dashboard.shortcuts'
  value jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, key)
);

create index if not exists user_layouts_user_id_idx on public.user_layouts (user_id);

alter table public.user_layouts enable row level security;

-- Policies: usuário só acessa o que é dele
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

-- Storage: backgrounds (imagem de fundo do usuário)
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
