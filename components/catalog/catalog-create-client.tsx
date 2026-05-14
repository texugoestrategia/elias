"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Partner = { id: string; name: string; is_internal?: boolean; priority?: number; active?: boolean }
type Node = { id: string; name: string; partner_id: string }

export function CatalogCreateClient({ initialPartners, initialNodes }: { initialPartners: Partner[]; initialNodes: Node[] }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [partners] = useState(initialPartners)
  const [nodes] = useState(initialNodes)

  const internal = partners.find((p) => p.is_internal) ?? partners[0]
  const [partnerId, setPartnerId] = useState<string>(internal?.id ?? "")
  const [kind, setKind] = useState<"product" | "service">("service")
  const [nodeId, setNodeId] = useState<string>(() => nodes.find((n) => n.partner_id === (internal?.id ?? ""))?.id ?? "")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredNodes = useMemo(() => nodes.filter((n) => n.partner_id === partnerId), [nodes, partnerId])

  const create = async () => {
    setError(null)
    setLoading(true)
    try {
      if (!partnerId) throw new Error("Selecione um parceiro.")
      if (!nodeId) throw new Error("Selecione uma categoria.")
      if (!name.trim()) throw new Error("Informe o nome.")
      const { data, error } = await supabase
        .from("partner_catalog_items")
        .insert({
          partner_id: partnerId,
          node_id: nodeId,
          kind,
          name: name.trim(),
          description: description.trim() || null,
          active: true,
        })
        .select("id")
        .single()
      if (error) throw error
      router.push(`/catalogo/${data.id}`)
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar item")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Novo item do Catálogo
        </h1>
        <p className="text-sm text-muted">Crie um produto/serviço e depois complete a página (galeria, datasheet, MEDDPICC, requisitos).</p>
      </header>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <div className="text-xs text-muted">Parceiro</div>
            <select
              value={partnerId}
              onChange={(e) => {
                const v = e.target.value
                setPartnerId(v)
                setNodeId(nodes.find((n) => n.partner_id === v)?.id ?? "")
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.is_internal ? "Active Solutions (interno)" : p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <div className="text-xs text-muted">Tipo</div>
            <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="service">Serviço</option>
              <option value="product">Produto</option>
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <div className="text-xs text-muted">Categoria</div>
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {!filteredNodes.length ? <option value="">(Sem categorias para este parceiro)</option> : null}
            {filteredNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <div className="text-xs text-muted">Nome</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <div className="text-xs text-muted">Descrição curta (opcional)</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-20"
          />
        </label>

        <div className="flex justify-end">
          <button type="button" onClick={create} disabled={loading} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60">
            {loading ? "Criando…" : "Criar e abrir página"}
          </button>
        </div>
      </div>
    </div>
  )
}

