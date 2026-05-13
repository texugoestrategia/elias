"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Partner = {
  id: string
  name: string
  segment: string | null
  website: string | null
  logo_url: string | null
  priority: number
  active: boolean
}

export function PartnersListClient({ initialPartners }: { initialPartners: Partner[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return partners
    return partners.filter((p) => (p.name + " " + (p.segment ?? "")).toLowerCase().includes(term))
  }, [partners, q])

  const reload = async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("id,name,segment,website,logo_url,priority,active")
        .order("priority", { ascending: false })
        .order("name", { ascending: true })
      if (error) throw error
      setPartners((data ?? []) as any)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar parceiros")
    } finally {
      setLoading(false)
    }
  }

  const bumpPriority = async (id: string, delta: number) => {
    setError(null)
    setLoading(true)
    try {
      const p = partners.find((x) => x.id === id)
      if (!p) return
      const next = (p.priority ?? 0) + delta
      const { error } = await supabase.from("partners").update({ priority: next, updated_at: new Date().toISOString() }).eq("id", id)
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao priorizar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Parceiros
          </h1>
          <p className="text-sm text-muted">Lista de parceiros. Clique para ver detalhes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/parceiros/gerenciar"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black"
            title="Área de gestão (admin)"
          >
            Gerenciar
          </Link>
          <button
            type="button"
            onClick={reload}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20"
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar parceiro…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="text-xs text-muted">{filtered.length} parceiro(s)</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/parceiros/${p.id}`}
            className="rounded-lg border border-border bg-surface p-3 hover:border-foreground/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-md border border-border bg-background overflow-hidden shrink-0 flex items-center justify-center">
                  {p.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted">{p.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted truncate">{p.segment ?? "—"}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted">Prioridade</div>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      bumpPriority(p.id, 1)
                    }}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-foreground/20"
                    title="Aumentar prioridade"
                  >
                    +
                  </button>
                  <div className="text-sm font-semibold w-6 text-center">{p.priority ?? 0}</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      bumpPriority(p.id, -1)
                    }}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-foreground/20"
                    title="Diminuir prioridade"
                  >
                    −
                  </button>
                </div>
              </div>
            </div>
          </Link>
        ))}
        {!filtered.length ? <div className="text-xs text-muted">Nenhum parceiro.</div> : null}
      </div>
    </div>
  )
}

