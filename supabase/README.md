# Supabase (mimir)

## Bootstrap (recomendado — 1x)

Para reduzir chance de erro, rode apenas:
- `supabase/bootstrap.sql`

Ele cria todo o schema do MVP (Time, Parceiros, RBAC, Preferências/Layout) e insere alguns registros de teste.

## Módulo Time (MVP+)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/team.sql`
3. Run

Isso cria:
- `public.team_members` (com skills/tags, avatar, etc)
- `public.team_member_certificates`
- Buckets `avatars` e `certificates` (públicos) + policies para usuários autenticados

Depois, no app:
- `/time` lista membros
- permite cadastrar/editar
- upload de avatar
- upload/listagem de certificados

## Parceiros + Pontos focais (MVP)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/partners.sql`
3. Run

Isso cria:
- `public.partners`
- `public.partner_contact_roles` (funções dinâmicas de ponto focal)
- `public.partner_focal_points` (contatos)

## Catálogo de parceiros (hierarquia + imagem + artigos internos)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/partners_catalog.sql`
3. Run

Isso cria:
- `public.partner_catalog_nodes` (árvore)
- `public.partner_catalog_items` (produto/serviço)
- `public.partner_catalog_item_articles` (artigos em texto/markdown)
- bucket `partner-assets` (imagens)

## Relatórios (histórico)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/reports.sql`
3. Run

Isso cria:
- `public.partner_monthly_reports` (histórico dos DOCX gerados)
- bucket `reports` (arquivos)

## Processos (Macro/Micro + arquivos + KPIs)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/processes.sql`
3. Run

Isso cria:
- `public.process_areas`
- `public.processes` (hierarquia + 5W2H)
- `public.process_files` (versionamento de anexos: BPMN/DEP/RACI/other)
- `public.process_kpis` e `public.process_kpi_values`
- bucket `process-assets` (anexos)

## Editais (lotes + pipeline + regras)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/editais.sql`
3. Run

Isso cria:
- `public.edital_batches`, `public.edital_files`, `public.editais`, `public.edital_jobs`
- artefatos reexecutáveis por estágio (`edital_extractions`, `edital_classifications`, `edital_normalizations`, `edital_evaluations`)
- regras versionadas em JSON (`edital_rule_sets`, `edital_rule_set_versions`)
- notificações (`user_notifications`)
- RPC `public.claim_next_edital_job(batch_id)` (simula fila/worker)
- bucket `editais` (arquivos)

## Organograma (posições + subordinação)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/org_chart.sql`
3. Run

Isso cria:
- `public.org_positions`
- `public.org_members`
- função `public.user_id_by_email(email)` (para o app cadastrar subordinação por email)

### Seed (estrutura inicial por funções)

Se você quiser carregar a estrutura do organograma (só cargos/funções), rode:
- `supabase/organograma_seed.sql`

## RBAC base (preparação para Processos)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/rbac.sql`
3. Run

Isso cria:
- `public.app_roles` (papéis dinâmicos)
- `public.user_roles` (atribuições por usuário + escopo opcional)
- função `public.has_role(role_key, partner_id)`

## Permissões (RBAC por capability)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/permissions.sql`
3. Run

Isso cria:
- `public.app_permissions`
- `public.role_permissions`
- função `public.has_permission(permission_key)`

## Preferências do usuário (Aparência + Layout / Drag & Drop)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/user_preferences.sql`
3. Run

Isso cria:
- `public.user_preferences` (tema, cores, fundo, densidade, etc.)
- `public.user_layouts` (ordens e layouts em JSON)
- bucket `backgrounds` (imagem de fundo) + policy para authenticated
