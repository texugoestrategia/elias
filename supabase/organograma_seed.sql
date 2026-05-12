-- Seed do organograma (estrutura de FUNÇÕES/POSIÇÕES)
-- A partir do PNG enviado: CEO + gerências + cargos subordinados.
--
-- Como usar:
-- 1) Supabase → SQL Editor → New query
-- 2) Cole este SQL
-- 3) Run
--
-- Observação:
-- - Este seed cria a hierarquia de posições (org_positions) via parent_id.
-- - Depois, você pode alocar colaboradores (por email) nessas posições via módulo de Diretório/Time.

do $$
begin
  -- Garante colunas para hierarquia (idempotente)
  alter table public.org_positions add column if not exists parent_id uuid null;
  alter table public.org_positions add column if not exists area text null;
  alter table public.org_positions add column if not exists sort_order int not null default 0;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'org_positions_parent_id_fkey'
  ) then
    alter table public.org_positions
      add constraint org_positions_parent_id_fkey
      foreign key (parent_id) references public.org_positions(id)
      on delete set null;
  end if;
end $$;

-- Upsert posições
insert into public.org_positions (key, name, description, area, sort_order)
values
  ('ceo', 'CEO', null, 'C-Level', 0),

  ('gerente_operacoes', 'Gerente de Operações', null, 'Operações', 10),
  ('gerente_pre_vendas', 'Gerente de Pré-Vendas', null, 'Comercial', 20),
  ('gerente_aliancas_growth', 'Gerente de Alianças e Growth', null, 'Crescimento', 30),
  ('gerente_comercial', 'Gerente Comercial', null, 'Comercial', 40),
  ('gerente_marketing', 'Gerente de Marketing', null, 'Marketing', 50),
  ('gerente_administrativo', 'Gerente Administrativo', null, 'Administrativo', 60),
  ('analista_logistica', 'Analista de Logística', null, 'Operações', 70),

  -- Operações
  ('gerente_projetos', 'Gerente de Projetos', null, 'Operações', 11),
  ('administrador_sistemas', 'Administrador de Sistemas', null, 'Operações', 12),
  ('analista_redes_1', 'Analista de Redes 1', null, 'Operações', 13),
  ('analista_redes_2', 'Analista de Redes 2', null, 'Operações', 14),
  ('analista_ciberseguranca', 'Analista de Cibersegurança', null, 'Operações', 15),

  -- Pré-vendas
  ('pre_vendas', 'Pré-Vendas', null, 'Comercial', 21),

  -- Alianças e Growth
  ('srd', 'SRD', null, 'Crescimento', 31),

  -- Comercial
  ('gerente_contas', 'Gerente de Contas', null, 'Comercial', 41),
  ('analista_vendas_gov', 'Analista de Vendas Gov.', null, 'Comercial', 42),

  -- Administrativo
  ('analista_administrativo', 'Analista Administrativo', null, 'Administrativo', 61),
  ('assistente_financeiro', 'Assistente Financeiro', null, 'Administrativo', 62),
  ('assistente_rh', 'Assistente de RH', null, 'Administrativo', 63)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  area = excluded.area,
  sort_order = excluded.sort_order;

-- Monta hierarquia (parent_id)
do $$
declare
  v_ceo uuid;
  v_op uuid;
  v_pre uuid;
  v_growth uuid;
  v_com uuid;
  v_mkt uuid;
  v_adm uuid;
begin
  select id into v_ceo from public.org_positions where key='ceo';
  select id into v_op from public.org_positions where key='gerente_operacoes';
  select id into v_pre from public.org_positions where key='gerente_pre_vendas';
  select id into v_growth from public.org_positions where key='gerente_aliancas_growth';
  select id into v_com from public.org_positions where key='gerente_comercial';
  select id into v_mkt from public.org_positions where key='gerente_marketing';
  select id into v_adm from public.org_positions where key='gerente_administrativo';

  -- Diretos do CEO
  update public.org_positions set parent_id = v_ceo where key in (
    'gerente_operacoes',
    'gerente_pre_vendas',
    'gerente_aliancas_growth',
    'gerente_comercial',
    'gerente_marketing',
    'gerente_administrativo',
    'analista_logistica'
  );

  -- Subordinados de Operações
  update public.org_positions set parent_id = v_op where key in (
    'gerente_projetos',
    'administrador_sistemas',
    'analista_redes_1',
    'analista_redes_2',
    'analista_ciberseguranca'
  );

  -- Subordinados de Pré-vendas
  update public.org_positions set parent_id = v_pre where key in ('pre_vendas');

  -- Subordinados de Growth
  update public.org_positions set parent_id = v_growth where key in ('srd');

  -- Subordinados de Comercial
  update public.org_positions set parent_id = v_com where key in ('gerente_contas','analista_vendas_gov');

  -- Subordinados de Administrativo
  update public.org_positions set parent_id = v_adm where key in ('analista_administrativo','assistente_financeiro','assistente_rh');
end $$;

