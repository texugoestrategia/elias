-- Catálogo de produtos/serviços por parceiro (hierarquia + imagem + artigos internos)
-- Rode este SQL no Supabase: SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Nós da árvore (categorias/subcategorias)
create table if not exists public.partner_catalog_nodes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  parent_id uuid null references public.partner_catalog_nodes(id) on delete cascade,
  name text not null,
  description text null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_catalog_nodes_partner_id_idx
  on public.partner_catalog_nodes (partner_id);
create index if not exists partner_catalog_nodes_parent_id_idx
  on public.partner_catalog_nodes (parent_id);

-- Itens (produto/serviço)
create table if not exists public.partner_catalog_items (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  node_id uuid not null references public.partner_catalog_nodes(id) on delete cascade,
  kind text not null default 'service' check (kind in ('product','service')),
  name text not null,
  description text null,
  long_description text null,
  image_url text null,
  price_amount numeric null,
  price_currency text null default 'BRL',
  price_notes text null,
  datasheet_storage_path text null,
  datasheet_url text null,
  -- MEDDPICC (campo por critério)
  meddpicc_metrics text null,
  meddpicc_economic_buyer text null,
  meddpicc_decision_criteria text null,
  meddpicc_decision_process text null,
  meddpicc_paper_process text null,
  meddpicc_identify_pain text null,
  meddpicc_champion text null,
  meddpicc_competition text null,
  tags text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_catalog_items_partner_id_idx
  on public.partner_catalog_items (partner_id);
create index if not exists partner_catalog_items_node_id_idx
  on public.partner_catalog_items (node_id);

-- Relações entre itens (ex.: produto do parceiro relacionado a produto interno / outro parceiro)
create table if not exists public.partner_catalog_item_relations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.partner_catalog_items(id) on delete cascade,
  related_item_id uuid not null references public.partner_catalog_items(id) on delete cascade,
  relation_type text not null default 'related' check (relation_type in ('related','bundle','alternative','addon','requires')),
  notes text null,
  created_at timestamptz not null default now()
);
create unique index if not exists partner_catalog_item_relations_unique
  on public.partner_catalog_item_relations(item_id, related_item_id, relation_type);
create index if not exists partner_catalog_item_relations_item_id_idx
  on public.partner_catalog_item_relations(item_id);

-- Galeria de imagens por item
create table if not exists public.partner_catalog_item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.partner_catalog_items(id) on delete cascade,
  storage_path text null,
  public_url text null,
  caption text null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_catalog_item_images_item_id_idx
  on public.partner_catalog_item_images (item_id);

-- Requisitos por item
create table if not exists public.partner_catalog_item_requirements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.partner_catalog_items(id) on delete cascade,
  kind text not null default 'technical' check (kind in ('technical','commercial','legal','delivery')),
  title text not null,
  description text null,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_catalog_item_requirements_item_id_idx
  on public.partner_catalog_item_requirements (item_id);

-- Artigos internos anexados ao item (texto/markdown)
create table if not exists public.partner_catalog_item_articles (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.partner_catalog_items(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_catalog_item_articles_item_id_idx
  on public.partner_catalog_item_articles (item_id);

alter table public.partner_catalog_nodes enable row level security;
alter table public.partner_catalog_items enable row level security;
alter table public.partner_catalog_item_articles enable row level security;
alter table public.partner_catalog_item_relations enable row level security;
alter table public.partner_catalog_item_images enable row level security;
alter table public.partner_catalog_item_requirements enable row level security;

-- Policies (se RBAC por permissão estiver instalado, usa has_permission; senão libera para authenticated)
do $$
declare
  has_perm boolean;
begin
  select exists(select 1 from pg_proc where proname = 'has_permission') into has_perm;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_nodes' and policyname='partner_catalog_nodes_select') then
    create policy "partner_catalog_nodes_select"
      on public.partner_catalog_nodes
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_items' and policyname='partner_catalog_items_select') then
    create policy "partner_catalog_items_select"
      on public.partner_catalog_items
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_item_articles' and policyname='partner_catalog_item_articles_select') then
    create policy "partner_catalog_item_articles_select"
      on public.partner_catalog_item_articles
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_item_relations' and policyname='partner_catalog_item_relations_select') then
    create policy "partner_catalog_item_relations_select"
      on public.partner_catalog_item_relations
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_item_images' and policyname='partner_catalog_item_images_select') then
    create policy "partner_catalog_item_images_select"
      on public.partner_catalog_item_images
      for select
      to authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_catalog_item_requirements' and policyname='partner_catalog_item_requirements_select') then
    create policy "partner_catalog_item_requirements_select"
      on public.partner_catalog_item_requirements
      for select
      to authenticated
      using (true);
  end if;

  drop policy if exists "partner_catalog_nodes_write" on public.partner_catalog_nodes;
  drop policy if exists "partner_catalog_items_write" on public.partner_catalog_items;
  drop policy if exists "partner_catalog_item_articles_write" on public.partner_catalog_item_articles;
  drop policy if exists "partner_catalog_item_relations_write" on public.partner_catalog_item_relations;
  drop policy if exists "partner_catalog_item_images_write" on public.partner_catalog_item_images;
  drop policy if exists "partner_catalog_item_requirements_write" on public.partner_catalog_item_requirements;

  if has_perm then
    create policy "partner_catalog_nodes_write"
      on public.partner_catalog_nodes
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));

    create policy "partner_catalog_items_write"
      on public.partner_catalog_items
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));

    create policy "partner_catalog_item_articles_write"
      on public.partner_catalog_item_articles
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));

    create policy "partner_catalog_item_relations_write"
      on public.partner_catalog_item_relations
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));

    create policy "partner_catalog_item_images_write"
      on public.partner_catalog_item_images
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));

    create policy "partner_catalog_item_requirements_write"
      on public.partner_catalog_item_requirements
      for all
      to authenticated
      using (public.has_permission('catalog.manage'))
      with check (public.has_permission('catalog.manage'));
  else
    create policy "partner_catalog_nodes_write"
      on public.partner_catalog_nodes
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "partner_catalog_items_write"
      on public.partner_catalog_items
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "partner_catalog_item_articles_write"
      on public.partner_catalog_item_articles
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "partner_catalog_item_relations_write"
      on public.partner_catalog_item_relations
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "partner_catalog_item_images_write"
      on public.partner_catalog_item_images
      for all
      to authenticated
      using (true)
      with check (true);

    create policy "partner_catalog_item_requirements_write"
      on public.partner_catalog_item_requirements
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Storage bucket para imagens de identificação do catálogo
insert into storage.buckets (id, name, public)
values ('partner-assets', 'partner-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='partner_assets_rw_authenticated') then
    create policy "partner_assets_rw_authenticated"
      on storage.objects
      for all
      to authenticated
      using (bucket_id = 'partner-assets')
      with check (bucket_id = 'partner-assets');
  end if;
end $$;
