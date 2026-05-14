"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { safeStorageFileName } from "@/lib/files/safe-name"
import { CollapsibleSection } from "@/components/ui/collapsible-section"

type CatalogNode = { id: string; name: string; partner_id: string }
type PartnerRef = { id: string; name: string; is_internal?: boolean; logo_url?: string | null }

type CatalogItem = {
  id: string
  partner_id: string
  node_id: string
  kind: "product" | "service"
  name: string
  description: string | null
  long_description?: string | null
  image_url: string | null
  price_amount?: number | null
  price_currency?: string | null
  price_notes?: string | null
  datasheet_url?: string | null
  datasheet_storage_path?: string | null
  // MEDDPICC
  meddpicc_metrics?: string | null
  meddpicc_economic_buyer?: string | null
  meddpicc_decision_criteria?: string | null
  meddpicc_decision_process?: string | null
  meddpicc_paper_process?: string | null
  meddpicc_identify_pain?: string | null
  meddpicc_champion?: string | null
  meddpicc_competition?: string | null
  partner?: PartnerRef | null
  node?: { id: string; name: string; partner_id: string } | null
}

type ItemImage = { id: string; item_id: string; public_url: string | null; caption: string | null; sort_order: number }
type Requirement = { id: string; item_id: string; kind: string; title: string; description: string | null; priority: number }
type Article = { id: string; item_id: string; title: string; content: string }
type Relation = { id: string; relation_type: string; notes: string | null; related: { id: string; name: string; partner?: PartnerRef | null } | null }

export function CatalogItemClient({
  initialItem,
  initialNodes,
  initialImages,
  initialRequirements,
  initialArticles,
  initialRelations,
}: {
  initialItem: CatalogItem
  initialNodes: CatalogNode[]
  initialImages: ItemImage[]
  initialRequirements: Requirement[]
  initialArticles: Article[]
  initialRelations: Relation[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [item, setItem] = useState<CatalogItem>(initialItem)
  const [nodes] = useState<CatalogNode[]>(initialNodes)
  const [images, setImages] = useState<ItemImage[]>(initialImages)
  const [reqs, setReqs] = useState<Requirement[]>(initialRequirements)
  const [articles, setArticles] = useState<Article[]>(initialArticles)
  const [relations, setRelations] = useState<Relation[]>(initialRelations)
  const [allItems, setAllItems] = useState<Array<{ id: string; name: string; partner_id: string; partner?: PartnerRef | null }>>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const partnerName = item.partner?.is_internal ? "Active Solutions" : item.partner?.name ?? "—"
  const nodeName = item.node?.name ?? nodes.find((n) => n.id === item.node_id)?.name ?? "—"

  const relevantNodes = useMemo(() => nodes.filter((n) => n.partner_id === item.partner_id), [nodes, item.partner_id])

  const reload = async () => {
    setError(null)
    setMsg(null)
    setSaving(true)
    try {
      const [{ data: itemRow }, { data: imgs }, { data: rs }, { data: arts }, { data: rels }] = await Promise.all([
        supabase
          .from("partner_catalog_items")
          .select("*, partner:partners(id,name,is_internal,logo_url), node:partner_catalog_nodes(id,name,partner_id)")
          .eq("id", item.id)
          .maybeSingle(),
        supabase.from("partner_catalog_item_images").select("*").eq("item_id", item.id).order("sort_order", { ascending: true }),
        supabase
          .from("partner_catalog_item_requirements")
          .select("*")
          .eq("item_id", item.id)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("partner_catalog_item_articles").select("*").eq("item_id", item.id).order("created_at", { ascending: false }),
        supabase
          .from("partner_catalog_item_relations")
          .select("id,relation_type,notes, related:partner_catalog_items(id,name,partner_id, partner:partners(id,name,is_internal))")
          .eq("item_id", item.id)
          .order("created_at", { ascending: false }),
      ])
      if (itemRow) setItem(itemRow as any)
      setImages((imgs ?? []) as any)
      setReqs((rs ?? []) as any)
      setArticles((arts ?? []) as any)
      setRelations((rels ?? []) as any)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao recarregar")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    // carregamos opções para relações (produto interno/outros parceiros)
    ;(async () => {
      const { data } = await supabase
        .from("partner_catalog_items")
        .select("id,name,partner_id, partner:partners(id,name,is_internal)")
        .order("name", { ascending: true })
        .limit(1000)
      setAllItems(((data ?? []) as any[]).filter((x) => x.id !== item.id))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const saveBasics = async (patch: Partial<CatalogItem>) => {
    setError(null)
    setMsg(null)
    setSaving(true)
    try {
      const next = { ...item, ...patch }
      const { error } = await supabase
        .from("partner_catalog_items")
        .update({
          name: next.name,
          kind: next.kind,
          description: next.description,
          long_description: next.long_description,
          price_amount: next.price_amount ?? null,
          price_currency: next.price_currency ?? "BRL",
          price_notes: next.price_notes ?? null,
          node_id: next.node_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
      if (error) throw error
      setMsg("Item atualizado.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const uploadDatasheet = async (file: File) => {
    setError(null)
    setMsg(null)
    setSaving(true)
    try {
      const path = `catalog/item/${item.id}/datasheet/${Date.now()}-${safeStorageFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from("partner-assets").upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("partner-assets").getPublicUrl(path)
      const { error } = await supabase
        .from("partner_catalog_items")
        .update({ datasheet_storage_path: path, datasheet_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", item.id)
      if (error) throw error
      setMsg("Datasheet enviado.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar datasheet")
    } finally {
      setSaving(false)
    }
  }

  const uploadGalleryImage = async (file: File) => {
    setError(null)
    setMsg(null)
    setSaving(true)
    try {
      const path = `catalog/item/${item.id}/gallery/${Date.now()}-${safeStorageFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from("partner-assets").upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("partner-assets").getPublicUrl(path)
      const { error } = await supabase.from("partner_catalog_item_images").insert({
        item_id: item.id,
        storage_path: path,
        public_url: data.publicUrl,
        caption: null,
        sort_order: images.length ? Math.max(...images.map((x) => x.sort_order ?? 0)) + 1 : 0,
      })
      if (error) throw error
      setMsg("Imagem adicionada.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar imagem")
    } finally {
      setSaving(false)
    }
  }

  const removeGalleryImage = async (id: string) => {
    if (!confirm("Remover imagem da galeria?")) return
    setSaving(true)
    try {
      const { error } = await supabase.from("partner_catalog_item_images").delete().eq("id", id)
      if (error) throw error
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const addRequirement = async (payload: Partial<Requirement>) => {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from("partner_catalog_item_requirements").insert({
        item_id: item.id,
        kind: payload.kind ?? "technical",
        title: payload.title ?? "Requisito",
        description: payload.description ?? null,
        priority: Number(payload.priority ?? 0),
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao adicionar requisito")
    } finally {
      setSaving(false)
    }
  }

  const removeRequirement = async (id: string) => {
    if (!confirm("Remover requisito?")) return
    setSaving(true)
    await supabase.from("partner_catalog_item_requirements").delete().eq("id", id)
    await reload()
    setSaving(false)
  }

  const addArticle = async (title: string, content: string) => {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from("partner_catalog_item_articles").insert({ item_id: item.id, title, content })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao adicionar artigo")
    } finally {
      setSaving(false)
    }
  }

  const addRelation = async (relatedId: string, relationType: string) => {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from("partner_catalog_item_relations").insert({
        item_id: item.id,
        related_item_id: relatedId,
        relation_type: relationType,
        notes: null,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao relacionar item")
    } finally {
      setSaving(false)
    }
  }

  const removeRelation = async (id: string) => {
    if (!confirm("Remover relação?")) return
    setSaving(true)
    await supabase.from("partner_catalog_item_relations").delete().eq("id", id)
    await reload()
    setSaving(false)
  }

  const [newReq, setNewReq] = useState({ kind: "technical", title: "", description: "", priority: 0 })
  const [newArticle, setNewArticle] = useState({ title: "", content: "" })
  const [relPick, setRelPick] = useState({ relatedId: "", relationType: "related" })
  const [med, setMed] = useState(() => ({
    metrics: item.meddpicc_metrics ?? "",
    economic_buyer: item.meddpicc_economic_buyer ?? "",
    decision_criteria: item.meddpicc_decision_criteria ?? "",
    decision_process: item.meddpicc_decision_process ?? "",
    paper_process: item.meddpicc_paper_process ?? "",
    identify_pain: item.meddpicc_identify_pain ?? "",
    champion: item.meddpicc_champion ?? "",
    competition: item.meddpicc_competition ?? "",
  }))

  const saveMed = async () => {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase
        .from("partner_catalog_items")
        .update({
          meddpicc_metrics: med.metrics || null,
          meddpicc_economic_buyer: med.economic_buyer || null,
          meddpicc_decision_criteria: med.decision_criteria || null,
          meddpicc_decision_process: med.decision_process || null,
          meddpicc_paper_process: med.paper_process || null,
          meddpicc_identify_pain: med.identify_pain || null,
          meddpicc_champion: med.champion || null,
          meddpicc_competition: med.competition || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
      if (error) throw error
      setMsg("MEDDPICC salvo.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar MEDDPICC")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xl font-semibold truncate">{item.name}</div>
            <div className="text-xs text-muted truncate">
              {partnerName} • {nodeName} • {item.kind === "product" ? "Produto" : "Serviço"}
            </div>
          </div>
          <details className="rounded-md border border-border bg-background p-2">
            <summary className="cursor-pointer text-xs font-medium">Mais ações</summary>
            <div className="mt-2 text-xs text-muted">Edição/Uploads ficam nas seções abaixo.</div>
          </details>
        </div>
        {item.description ? <div className="text-sm text-muted mt-3 whitespace-pre-wrap">{item.description}</div> : null}
      </div>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      {msg ? <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{msg}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          <CollapsibleSection title="Galeria de imagens" description="Imagens para proposta/apresentação." defaultOpen>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.id} className="rounded-md border border-border bg-background p-2">
                  <div className="aspect-video rounded-md overflow-hidden bg-surface border border-border">
                    {img.public_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.public_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(img.id)}
                    className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-foreground/20"
                    disabled={saving}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <input
                type="file"
                accept="image/*"
                disabled={saving}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  await uploadGalleryImage(f)
                  e.target.value = ""
                }}
                className="text-xs"
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Descrição completa" description="Long text (para pré-vendas e proposta)." defaultOpen={false}>
            <textarea
              value={String(item.long_description ?? "")}
              onChange={(e) => setItem((it) => ({ ...it, long_description: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-48"
              placeholder="Descreva o produto/serviço em detalhes…"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => saveBasics({ long_description: item.long_description ?? "" })}
                disabled={saving}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
              >
                Salvar
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Datasheet" description="Anexo técnico (PDF, DOCX, etc.)." defaultOpen={false}>
            {item.datasheet_url ? (
              <a href={item.datasheet_url} target="_blank" className="text-sm underline">
                Abrir datasheet
              </a>
            ) : (
              <div className="text-sm text-muted">Sem datasheet ainda.</div>
            )}
            <div className="mt-3">
              <input
                type="file"
                disabled={saving}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  await uploadDatasheet(f)
                  e.target.value = ""
                }}
                className="text-xs"
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Artigos relacionados" description="Conteúdo interno (texto) para apoiar vendas e pré-vendas." defaultOpen={false}>
            <div className="space-y-2">
              {articles.map((a) => (
                <details key={a.id} className="rounded-md border border-border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-medium">{a.title}</summary>
                  <div className="mt-2 text-sm text-muted whitespace-pre-wrap">{a.content}</div>
                </details>
              ))}
              {!articles.length ? <div className="text-sm text-muted">Nenhum artigo.</div> : null}
            </div>
            <div className="mt-3 rounded-md border border-border bg-background p-3 space-y-2">
              <div className="text-sm font-medium">Adicionar artigo</div>
              <input
                value={newArticle.title}
                onChange={(e) => setNewArticle((s) => ({ ...s, title: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Título"
              />
              <textarea
                value={newArticle.content}
                onChange={(e) => setNewArticle((s) => ({ ...s, content: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm min-h-24"
                placeholder="Conteúdo"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving || !newArticle.title.trim() || !newArticle.content.trim()}
                  onClick={async () => {
                    await addArticle(newArticle.title.trim(), newArticle.content.trim())
                    setNewArticle({ title: "", content: "" })
                  }}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </CollapsibleSection>
        </section>

        <aside className="space-y-4">
          <CollapsibleSection title="Dados (básico)" description="Nome, tipo, categoria e preço." defaultOpen>
            <div className="space-y-2">
              <label className="block space-y-1">
                <div className="text-xs text-muted">Nome</div>
                <input
                  value={item.name}
                  onChange={(e) => setItem((it) => ({ ...it, name: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <div className="text-xs text-muted">Tipo</div>
                  <select
                    value={item.kind}
                    onChange={(e) => setItem((it) => ({ ...it, kind: e.target.value as any }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="service">Serviço</option>
                    <option value="product">Produto</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <div className="text-xs text-muted">Categoria</div>
                  <select
                    value={item.node_id}
                    onChange={(e) => setItem((it) => ({ ...it, node_id: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {relevantNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <div className="text-xs text-muted">Descrição curta</div>
                <textarea
                  value={String(item.description ?? "")}
                  onChange={(e) => setItem((it) => ({ ...it, description: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-20"
                />
              </label>

              <details className="rounded-md border border-border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium">Preço (opcional)</summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <div className="text-xs text-muted">Valor</div>
                    <input
                      value={item.price_amount ?? ""}
                      onChange={(e) => setItem((it) => ({ ...it, price_amount: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block space-y-1">
                    <div className="text-xs text-muted">Moeda</div>
                    <select
                      value={item.price_currency ?? "BRL"}
                      onChange={(e) => setItem((it) => ({ ...it, price_currency: e.target.value }))}
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 mt-2">
                  <div className="text-xs text-muted">Observações</div>
                  <textarea
                    value={String(item.price_notes ?? "")}
                    onChange={(e) => setItem((it) => ({ ...it, price_notes: e.target.value }))}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm min-h-16"
                  />
                </label>
              </details>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving || !item.name.trim()}
                  onClick={() =>
                    saveBasics({
                      name: item.name.trim(),
                      kind: item.kind,
                      node_id: item.node_id,
                      description: item.description ?? null,
                      price_amount: item.price_amount ?? null,
                      price_currency: item.price_currency ?? "BRL",
                      price_notes: item.price_notes ?? null,
                    })
                  }
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
                >
                  Salvar
                </button>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Requisitos" description="Pré-vendas: requisitos técnicos/comerciais/legais/entrega." defaultOpen={false}>
            <div className="space-y-2">
              {reqs.map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-xs text-muted">{r.kind + (r.description ? ` • ${r.description}` : "")}</div>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => removeRequirement(r.id)}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-foreground/20"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              {!reqs.length ? <div className="text-sm text-muted">Nenhum requisito.</div> : null}
            </div>
            <div className="mt-3 rounded-md border border-border bg-background p-3 space-y-2">
              <div className="text-sm font-medium">Adicionar requisito</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newReq.kind}
                  onChange={(e) => setNewReq((s) => ({ ...s, kind: e.target.value }))}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="technical">Técnico</option>
                  <option value="commercial">Comercial</option>
                  <option value="legal">Jurídico</option>
                  <option value="delivery">Entrega</option>
                </select>
                <input
                  value={String(newReq.priority)}
                  onChange={(e) => setNewReq((s) => ({ ...s, priority: Number(e.target.value) }))}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  inputMode="numeric"
                  placeholder="Prioridade"
                />
              </div>
              <input
                value={newReq.title}
                onChange={(e) => setNewReq((s) => ({ ...s, title: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Título"
              />
              <textarea
                value={newReq.description}
                onChange={(e) => setNewReq((s) => ({ ...s, description: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm min-h-16"
                placeholder="Descrição"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving || !newReq.title.trim()}
                  onClick={async () => {
                    await addRequirement(newReq)
                    setNewReq({ kind: "technical", title: "", description: "", priority: 0 })
                  }}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="MEDDPICC" description="Campos por critério (para proposta).”" defaultOpen={false}>
            <div className="space-y-2">
              <Field label="Metrics" value={med.metrics} onChange={(v) => setMed((m) => ({ ...m, metrics: v }))} />
              <Field
                label="Economic Buyer"
                value={med.economic_buyer}
                onChange={(v) => setMed((m) => ({ ...m, economic_buyer: v }))}
              />
              <Field
                label="Decision Criteria"
                value={med.decision_criteria}
                onChange={(v) => setMed((m) => ({ ...m, decision_criteria: v }))}
              />
              <Field
                label="Decision Process"
                value={med.decision_process}
                onChange={(v) => setMed((m) => ({ ...m, decision_process: v }))}
              />
              <Field
                label="Paper Process"
                value={med.paper_process}
                onChange={(v) => setMed((m) => ({ ...m, paper_process: v }))}
              />
              <Field
                label="Identify Pain"
                value={med.identify_pain}
                onChange={(v) => setMed((m) => ({ ...m, identify_pain: v }))}
              />
              <Field label="Champion" value={med.champion} onChange={(v) => setMed((m) => ({ ...m, champion: v }))} />
              <Field
                label="Competition"
                value={med.competition}
                onChange={(v) => setMed((m) => ({ ...m, competition: v }))}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveMed}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
                >
                  Salvar MEDDPICC
                </button>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Relações" description="Relacionar com itens internos (Active) ou de outros parceiros." defaultOpen={false}>
            <div className="space-y-2">
              {relations.map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{r.related?.name ?? "—"}</div>
                      <div className="text-xs text-muted">
                        {(r.related?.partner?.is_internal ? "Active Solutions" : r.related?.partner?.name ?? "—") + ` • ${r.relation_type}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => removeRelation(r.id)}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-foreground/20"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              {!relations.length ? <div className="text-sm text-muted">Nenhuma relação.</div> : null}
            </div>

            <div className="mt-3 rounded-md border border-border bg-background p-3 space-y-2">
              <div className="text-sm font-medium">Adicionar relação</div>
              <select
                value={relPick.relatedId}
                onChange={(e) => setRelPick((s) => ({ ...s, relatedId: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="">Selecione um item…</option>
                {allItems.map((x) => (
                  <option key={x.id} value={x.id}>
                    {(x.partner?.is_internal ? "Active Solutions" : x.partner?.name ?? "—") + " — " + x.name}
                  </option>
                ))}
              </select>
              <select
                value={relPick.relationType}
                onChange={(e) => setRelPick((s) => ({ ...s, relationType: e.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="related">Relacionado</option>
                <option value="bundle">Bundle</option>
                <option value="alternative">Alternativa</option>
                <option value="addon">Add-on</option>
                <option value="requires">Requer</option>
              </select>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving || !relPick.relatedId}
                  onClick={async () => {
                    await addRelation(relPick.relatedId, relPick.relationType)
                    setRelPick({ relatedId: "", relationType: "related" })
                  }}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </CollapsibleSection>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <div className="text-[11px] text-muted">{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-16" />
    </label>
  )
}

