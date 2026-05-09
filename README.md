## Mimir (Fase 1) — Projeto base

Projeto inicializado conforme o briefing:
- Next.js 14 (App Router)
- Tailwind CSS
- Stubs para Supabase e NextAuth (Azure AD)

## Getting Started

### 1) Instalar dependências

```bash
npm install
```

### 2) Variáveis de ambiente

Copie o arquivo `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

Para o login de teste (temporário), configure:

- `TEST_USER_USERNAME=elias`
- `TEST_USER_PASSWORD=3lias@321`

### 3) Rodar em desenvolvimento

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Estrutura (resumo)

- `app/(dashboard)/*` — telas base (dashboard/parceiros/time/processos/editais)
- `app/(auth)/login` — tela de login (placeholder)
- `auth.ts` + `app/api/auth/[...nextauth]/route.ts` — NextAuth (Azure AD)
- `lib/supabase/*` — clientes Supabase (browser/server)

## Deploy na Vercel (resumo)

1. Faça commit/push para o GitHub (`texugoestrategia/elias`)
2. Na Vercel, garanta que as variáveis do `.env.local` estão cadastradas em **Project Settings → Environment Variables**
3. Deploy automático a partir da branch `main`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
