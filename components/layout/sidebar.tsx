import Link from "next/link"

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/parceiros", label: "Parceiros" },
  { href: "/time", label: "Time" },
  { href: "/processos", label: "Processos" },
  { href: "/editais", label: "Editais" },
]

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface">
      <div className="px-4 py-4 border-b border-border">
        <div className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Mimir
        </div>
        <div className="text-xs text-muted">Segurança & Privacidade</div>
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

