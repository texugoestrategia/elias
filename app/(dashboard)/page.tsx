import Link from "next/link"
import { AlertBanner } from "@/components/layout/alert-banner"
import { createClient } from "@/lib/supabase/server"

const defaultShortcuts = [
  { href: "/parceiros", label: "Parceiros" },
  { href: "/time", label: "Time" },
  { href: "/processos", label: "Processos" },
  { href: "/editais", label: "Editais" },
]

function applyLayout(items: typeof defaultShortcuts, layout: any | null) {
  const order: string[] = Array.isArray(layout?.order) ? layout.order : []
  const hidden: string[] = Array.isArray(layout?.hidden) ? layout.hidden : []

  const byHref = new Map(items.map((i) => [i.href, i]))
  const out: typeof defaultShortcuts = []
  for (const href of order) {
    const it = byHref.get(href)
    if (!it) continue
    if (hidden.includes(href)) continue
    out.push(it)
    byHref.delete(href)
  }
  for (const it of byHref.values()) {
    if (hidden.includes(it.href)) continue
    out.push(it)
  }
  return out
}

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: layoutRow } = user
    ? await supabase
        .from("user_layouts")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", "dashboard.shortcuts")
        .maybeSingle()
    : { data: null as any }

  const shortcuts = applyLayout(defaultShortcuts, layoutRow?.value ?? null)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        Dashboard
      </h1>

      <AlertBanner
        items={[
          {
            title: "Ambiente de desenvolvimento",
            description:
              "Este projeto foi inicializado e está pronto para evoluir com Supabase (Auth + DB) e RBAC.",
          },
        ]}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20"
          >
            <div className="text-sm text-muted">Acessar</div>
            <div className="text-lg font-medium">{item.label}</div>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="text-sm font-medium mb-2">Próximos passos</div>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">
          <li>Configurar variáveis de ambiente (Supabase/NextAuth/Azure AD)</li>
          <li>Adicionar shadcn/ui e componentes do design system</li>
          <li>Implementar o schema/migrations no Supabase</li>
        </ul>
      </section>
    </div>
  )
}
