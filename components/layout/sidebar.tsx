import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { AppLogo } from "@/components/layout/logo"

const defaultNavItems = [
  { href: "/", label: "Dashboard" },
  { href: "/parceiros", label: "Parceiros" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/time", label: "Time" },
  { href: "/processos", label: "Processos" },
  { href: "/editais", label: "Editais" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/configuracoes", label: "Configurações" },
]

function applySidebarLayout(
  items: typeof defaultNavItems,
  layout: any | null
): typeof defaultNavItems {
  const order: string[] = Array.isArray(layout?.order) ? layout.order : []
  const hidden: string[] = Array.isArray(layout?.hidden) ? layout.hidden : []

  const byHref = new Map(items.map((i) => [i.href, i]))
  const out: typeof defaultNavItems = []

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

export async function Sidebar() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: layoutRow } = user
    ? await supabase.from("user_layouts").select("value").eq("user_id", user.id).eq("key", "sidebar").maybeSingle()
    : { data: null as any }

  const navItems = applySidebarLayout(defaultNavItems, layoutRow?.value ?? null)
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          {/* Se existir em public/img/logo.png, ele aparece aqui. */}
          <AppLogo size={44} />
          <div>
            <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Mimir
            </div>
            <div className="text-xs text-muted">Fonte da Sabedoria</div>
          </div>
        </div>
      </div>
      <nav className="p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-border/40"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
