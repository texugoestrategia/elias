"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

type CatalogListItem = {
  id: string
  name: string
  kind: "product" | "service"
  description: string | null
  image_url: string | null
  partner_id: string
  partners?: { id: string; name: string; is_internal?: boolean; logo_url?: string | null } | null
  node?: { id: string; name: string } | null
}

export function CatalogListClient({ initialItems }: { initialItems: CatalogListItem[] }) {
  const [q, setQ] = useState("")
  const [items] = useState<CatalogListItem[]>(initialItems)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter((i) => (i.name + " " + (i.partners?.name ?? "") + " " + (i.node?.name ?? "")).toLowerCase().includes(term))
  }, [items, q])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Catálogo (Produtos/Serviços)
        </h1>
        <p className="text-sm text-muted">Clique para abrir a página completa do item (galeria, datasheet, MEDDPICC, requisitos).</p>
      </header>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Buscar item, parceiro ou categoria…"
        />
        <div className="text-xs text-muted">{filtered.length} item(ns)</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map((i) => (
          <Link key={i.id} href={`/catalogo/${i.id}`} className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-md border border-border bg-background overflow-hidden shrink-0 flex items-center justify-center">
                {i.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-muted">{i.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{i.name}</div>
                <div className="text-xs text-muted truncate">
                  {(i.partners?.is_internal ? "Active Solutions" : i.partners?.name ?? "—") + (i.node?.name ? ` • ${i.node.name}` : "")}
                </div>
                {i.description ? <div className="text-xs text-muted mt-1 line-clamp-2">{i.description}</div> : null}
              </div>
            </div>
          </Link>
        ))}
        {!filtered.length ? <div className="text-xs text-muted">Nenhum item.</div> : null}
      </div>
    </div>
  )
}

