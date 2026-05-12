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

## RBAC base (preparação para Processos)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/rbac.sql`
3. Run

Isso cria:
- `public.app_roles` (papéis dinâmicos)
- `public.user_roles` (atribuições por usuário + escopo opcional)
- função `public.has_role(role_key, partner_id)`

## Preferências do usuário (Aparência + Layout / Drag & Drop)

1. Supabase → SQL Editor → New query
2. Cole o conteúdo de `supabase/user_preferences.sql`
3. Run

Isso cria:
- `public.user_preferences` (tema, cores, fundo, densidade, etc.)
- `public.user_layouts` (ordens e layouts em JSON)
- bucket `backgrounds` (imagem de fundo) + policy para authenticated
