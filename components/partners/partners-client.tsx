"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { safeStorageFileName } from "@/lib/files/safe-name"
import { TagInput } from "@/components/time/tag-input"

type Partner = {
  id: string
  name: string
  legal_name: string | null
  cnpj: string | null
  segment: string | null
  website: string | null
  logo_url: string | null
  priority: number
  notes: string | null
  tags: string[]
  active: boolean
  created_at: string
  updated_at: string
  focals?: PartnerFocalPoint[]
}

type PartnerRole = {
  id: string
  name: string
  description: string | null
}

type PartnerFocalPoint = {
  id: string
  partner_id: string
  role_id: string | null
  name: string
  email: string | null
  phone: string | null
  department: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

type CatalogNode = {
  id: string
  partner_id: string
  parent_id: string | null
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

type CatalogItem = {
  id: string
  partner_id: string
  node_id: string
  kind: "product" | "service"
  name: string
  description: string | null
  image_url: string | null
  meddpicc_metrics?: string | null
  meddpicc_economic_buyer?: string | null
  meddpicc_decision_criteria?: string | null
  meddpicc_decision_process?: string | null
  meddpicc_paper_process?: string | null
  meddpicc_identify_pain?: string | null
  meddpicc_champion?: string | null
  meddpicc_competition?: string | null
  tags: string[]
  active: boolean
  created_at: string
  updated_at: string
  articles?: CatalogArticle[]
}

type CatalogArticle = {
  id: string
  item_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

type PartnerMaterial = {
  id: string
  partner_id: string
  title: string
  type: "general" | "deck" | "one_pager" | "case" | "datasheet" | "video" | "link"
  storage_path: string | null
  public_url: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export function PartnersClient({
  initialPartners,
  initialRoles,
  initialSelectedPartnerId,
}: {
  initialPartners: Partner[]
  initialRoles: PartnerRole[]
  initialSelectedPartnerId?: string | null
}) {
  const supabase = useMemo(() => createClient(), [])

  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [roles, setRoles] = useState<PartnerRole[]>(initialRoles)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    initialSelectedPartnerId ?? initialPartners[0]?.id ?? null
  )
  const [tab, setTab] = useState<"focals" | "catalog" | "materials">("focals")

  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editPartner, setEditPartner] = useState<Partial<Partner>>({})

  const selected = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId]
  )

  const reload = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const [{ data: partnersData, error: pErr }, { data: rolesData, error: rErr }] = await Promise.all([
        supabase
          .from("partners")
          .select("*, focals:partner_focal_points(*)")
          .order("priority", { ascending: false })
          .order("name", { ascending: true }),
        supabase.from("partner_contact_roles").select("*").order("name", { ascending: true }),
      ])

      if (pErr) throw pErr
      if (rErr) throw rErr

      setPartners((partnersData ?? []).map((p: any) => ({ ...p, tags: Array.isArray(p.tags) ? p.tags : [] })))
      setRoles(rolesData ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar parceiros")
    } finally {
      setLoading(false)
    }
  }

  const savePartnerBasics = async () => {
    if (!selected) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const patch: any = {
        name: String(editPartner.name ?? selected.name ?? "").trim(),
        legal_name: (editPartner.legal_name ?? selected.legal_name) || null,
        cnpj: (editPartner.cnpj ?? selected.cnpj) || null,
        segment: (editPartner.segment ?? selected.segment) || null,
        website: (editPartner.website ?? selected.website) || null,
        notes: (editPartner.notes ?? selected.notes) || null,
        updated_at: new Date().toISOString(),
      }
      if (!patch.name) throw new Error("Nome é obrigatório.")
      const { error } = await supabase.from("partners").update(patch).eq("id", selected.id)
      if (error) throw error
      setMessage("Parceiro atualizado.")
      setEditPartner({})
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar parceiro")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return partners
    return partners.filter((p) => {
      const hay = [
        p.name,
        p.legal_name ?? "",
        p.cnpj ?? "",
        p.segment ?? "",
        p.website ?? "",
        ...(p.tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(term)
    })
  }, [partners, q])

  const createPartner = async (payload: Partial<Partner>) => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("partners")
        .insert({
          name: payload.name,
          legal_name: payload.legal_name ?? null,
          cnpj: payload.cnpj ?? null,
          segment: payload.segment ?? null,
          website: payload.website ?? null,
          notes: payload.notes ?? null,
          tags: payload.tags ?? [],
          active: payload.active ?? true,
        })
        .select("*")
        .single()
      if (error) throw error
      await reload()
      setSelectedPartnerId(data?.id ?? null)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar parceiro")
    } finally {
      setLoading(false)
    }
  }

  const upsertRole = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    setLoading(true)
    try {
      const existing = roles.find((r) => r.name.toLowerCase() === trimmed.toLowerCase())
      if (existing) return
      const { error } = await supabase.from("partner_contact_roles").insert({ name: trimmed })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar função")
    } finally {
      setLoading(false)
    }
  }

  const addFocal = async (partnerId: string, payload: Partial<PartnerFocalPoint>) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("partner_focal_points").insert({
        partner_id: partnerId,
        role_id: payload.role_id ?? null,
        name: payload.name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        department: payload.department ?? null,
        is_primary: payload.is_primary ?? false,
        notes: payload.notes ?? null,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao adicionar ponto focal")
    } finally {
      setLoading(false)
    }
  }

  const uploadPartnerLogo = async (partnerId: string, file: File) => {
    setError(null)
    setLoading(true)
    try {
      const path = `partner/${partnerId}/logo/${Date.now()}-${safeStorageFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from("partner-assets").upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("partner-assets").getPublicUrl(path)
      const { error } = await supabase
        .from("partners")
        .update({ logo_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", partnerId)
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar logo")
    } finally {
      setLoading(false)
    }
  }

  const bumpPriority = async (partnerId: string, delta: number) => {
    if (!selected) return
    setError(null)
    setLoading(true)
    try {
      const next = (selected.priority ?? 0) + delta
      const { error } = await supabase.from("partners").update({ priority: next, updated_at: new Date().toISOString() }).eq("id", partnerId)
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao priorizar")
    } finally {
      setLoading(false)
    }
  }

  const deletePartner = async (partnerId: string) => {
    if (!confirm("Tem certeza que deseja remover este parceiro? Isso remove também pontos focais, catálogo e materiais.")) return
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("partners").delete().eq("id", partnerId)
      if (error) throw error
      await reload()
      setSelectedPartnerId(null)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao remover parceiro")
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
          <p className="text-sm text-muted">
            Cadastro de parceiros e pontos focais (somente contatos). Preparado para RBAC e futuras integrações.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-1 space-y-3">
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar parceiro…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted">{filtered.length} parceiro(s)</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="text-sm font-medium">Novo parceiro</div>
            <CreatePartnerForm onCreate={createPartner} loading={loading} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="text-sm font-medium">Funções (dinâmico)</div>
            <RoleQuickAdd roles={roles} onAdd={upsertRole} loading={loading} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPartnerId(p.id)}
                className={
                  "w-full text-left px-3 py-2 rounded-md hover:bg-background/60 " +
                  (p.id === selectedPartnerId ? "bg-background/70 border border-border" : "")
                }
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md border border-border bg-background overflow-hidden shrink-0 flex items-center justify-center">
                    {p.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted">{p.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted truncate">
                      {(p.segment ?? "—") + ` • prioridade ${p.priority ?? 0}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold truncate">{selected.name}</div>
                    <div className="text-xs text-muted truncate">
                      {(selected.legal_name ?? "—") + (selected.cnpj ? ` • ${selected.cnpj}` : "")}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {(selected.segment ?? "—") + (selected.website ? ` • ${selected.website}` : "")}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted">Prioridade: {selected.priority ?? 0}</div>
                    <details className="mt-2 rounded-md border border-border bg-background p-2">
                      <summary className="cursor-pointer text-xs font-medium">Mais ações</summary>
                      <div className="mt-2 space-y-2">
                        <div className="text-xs text-muted">Ajustar prioridade</div>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => bumpPriority(selected.id, 1)}
                            className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:border-foreground/20"
                          >
                            +
                          </button>
                          <div className="text-sm font-semibold w-6 text-center">{selected.priority ?? 0}</div>
                          <button
                            type="button"
                            onClick={() => bumpPriority(selected.id, -1)}
                            className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:border-foreground/20"
                          >
                            −
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => deletePartner(selected.id)}
                          className="w-full rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:border-danger/60"
                        >
                          Remover parceiro
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-md border border-border bg-background p-3 space-y-2">
                    <div className="text-xs text-muted">Logo do parceiro</div>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={loading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        await uploadPartnerLogo(selected.id, file)
                        e.target.value = ""
                      }}
                      className="text-xs"
                    />
                    {selected.logo_url ? (
                      <a className="text-xs underline text-muted" href={selected.logo_url} target="_blank">
                        Abrir logo
                      </a>
                    ) : (
                      <div className="text-xs text-muted">Sem logo ainda.</div>
                    )}
                  </div>
                  <div className="rounded-md border border-border bg-background p-3 space-y-2">
                    <div className="text-xs text-muted">Website</div>
                    {selected.website ? (
                      <a className="text-xs underline" href={selected.website} target="_blank">
                        {selected.website}
                      </a>
                    ) : (
                      <div className="text-xs text-muted">—</div>
                    )}
                  </div>
                </div>

                <details className="rounded-md border border-border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-medium">Editar dados do parceiro</summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <div className="text-xs text-muted">Nome</div>
                      <input
                        value={String(editPartner.name ?? selected.name ?? "")}
                        onChange={(e) => setEditPartner((p) => ({ ...p, name: e.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1">
                      <div className="text-xs text-muted">Nome legal</div>
                      <input
                        value={String(editPartner.legal_name ?? selected.legal_name ?? "")}
                        onChange={(e) => setEditPartner((p) => ({ ...p, legal_name: e.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1">
                      <div className="text-xs text-muted">CNPJ</div>
                      <input
                        value={String(editPartner.cnpj ?? selected.cnpj ?? "")}
                        onChange={(e) => setEditPartner((p) => ({ ...p, cnpj: e.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1">
                      <div className="text-xs text-muted">Segmento</div>
                      <input
                        value={String(editPartner.segment ?? selected.segment ?? "")}
                        onChange={(e) => setEditPartner((p) => ({ ...p, segment: e.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1 md:col-span-2">
                      <div className="text-xs text-muted">Website</div>
                      <input
                        value={String(editPartner.website ?? selected.website ?? "")}
                        onChange={(e) => setEditPartner((p) => ({ ...p, website: e.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block space-y-1 md:col-span-2">
                      <div className="text-xs text-muted">Notas</div>
                      <textarea
                        value={String(editPartner.notes ?? selected.notes ?? "")}
                        onChange={(e) => setEditPartner((p) => ({ ...p, notes: e.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm min-h-24"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={savePartnerBasics}
                      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
                    >
                      Salvar alterações
                    </button>
                  </div>
                </details>
                <div className="pt-2">
                  <div className="text-xs text-muted mb-1">Tags</div>
                  <TagInput
                    value={selected.tags ?? []}
                    onChange={async (tags) => {
                      await supabase.from("partners").update({ tags, updated_at: new Date().toISOString() }).eq("id", selected.id)
                      await reload()
                    }}
                    placeholder="Ex.: estratégico, fornecedor, governo…"
                  />
                </div>
                <div className="pt-3 border-t border-border flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("focals")}
                    className={
                      "rounded-md border border-border px-3 py-1.5 text-xs " +
                      (tab === "focals" ? "bg-background" : "bg-surface hover:border-foreground/20")
                    }
                  >
                    Pontos focais
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("catalog")}
                    className={
                      "rounded-md border border-border px-3 py-1.5 text-xs " +
                      (tab === "catalog" ? "bg-background" : "bg-surface hover:border-foreground/20")
                    }
                  >
                    Catálogo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("materials")}
                    className={
                      "rounded-md border border-border px-3 py-1.5 text-xs " +
                      (tab === "materials" ? "bg-background" : "bg-surface hover:border-foreground/20")
                    }
                  >
                    Materiais
                  </button>
                  <div className="text-xs text-muted">
                    {tab === "catalog"
                      ? "Produtos/serviços por categoria, com imagem, MEDDPICC e artigos internos."
                      : tab === "materials"
                        ? "Materiais de divulgação (PDFs, decks, links)."
                        : "Contatos do parceiro (sem login externo)."}
                  </div>
                </div>
              </div>

              {tab === "focals" ? (
                <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Pontos focais</div>
                    <div className="text-xs text-muted">{selected.focals?.length ?? 0}</div>
                  </div>
                  <AddFocalForm partnerId={selected.id} roles={roles} onAdd={addFocal} loading={loading} />

                  <div className="space-y-2">
                    {(selected.focals ?? [])
                      .slice()
                      .sort((a, b) => (a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1))
                      .map((f) => (
                        <div key={f.id} className="rounded-md border border-border bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {f.name}{" "}
                                {f.is_primary ? (
                                  <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                                    Principal
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-muted truncate">
                                {(f.email ?? "—") + (f.phone ? ` • ${f.phone}` : "")}
                              </div>
                              <div className="text-xs text-muted truncate">
                                {roleName(roles, f.role_id) + (f.department ? ` • ${f.department}` : "")}
                              </div>
                              {f.notes ? <div className="text-xs text-muted mt-1">{f.notes}</div> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    {!selected.focals?.length ? (
                      <div className="text-xs text-muted">Nenhum ponto focal cadastrado ainda.</div>
                    ) : null}
                  </div>
                </div>
              ) : tab === "catalog" ? (
                <PartnerCatalog partnerId={selected.id} />
              ) : (
                <PartnerMaterials partnerId={selected.id} />
              )}
            </>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
              Selecione um parceiro para ver detalhes.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function roleName(roles: PartnerRole[], roleId: string | null) {
  if (!roleId) return "Sem função"
  return roles.find((r) => r.id === roleId)?.name ?? "Sem função"
}

function CreatePartnerForm({
  onCreate,
  loading,
}: {
  onCreate: (payload: Partial<Partner>) => Promise<void>
  loading: boolean
}) {
  const [name, setName] = useState("")
  const [segment, setSegment] = useState("")
  const [website, setWebsite] = useState("")
  const [tags, setTags] = useState<string[]>([])

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <div className="text-xs text-muted">Nome</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block space-y-1">
        <div className="text-xs text-muted">Segmento</div>
        <input
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="ex.: Consultoria"
        />
      </label>
      <label className="block space-y-1">
        <div className="text-xs text-muted">Website</div>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="https://..."
        />
      </label>
      <div>
        <div className="text-xs text-muted mb-1">Tags</div>
        <TagInput value={tags} onChange={setTags} placeholder="Ex.: estratégico, fornecedor…" />
      </div>
      <button
        type="button"
        disabled={loading || !name.trim()}
        onClick={async () => {
          await onCreate({ name: name.trim(), segment: segment.trim() || null, website: website.trim() || null, tags })
          setName("")
          setSegment("")
          setWebsite("")
          setTags([])
        }}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Criar parceiro"}
      </button>
    </div>
  )
}

function RoleQuickAdd({
  roles,
  onAdd,
  loading,
}: {
  roles: PartnerRole[]
  onAdd: (name: string) => Promise<void>
  loading: boolean
}) {
  const [name, setName] = useState("")
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="ex.: Contratos"
        />
        <button
          type="button"
          disabled={loading || !name.trim()}
          onClick={async () => {
            await onAdd(name)
            setName("")
          }}
          className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-foreground/20 disabled:opacity-60"
        >
          Adicionar
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(roles ?? []).slice(0, 12).map((r) => (
          <span key={r.id} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted">
            {r.name}
          </span>
        ))}
        {(roles ?? []).length > 12 ? <span className="text-[11px] text-muted">+{roles.length - 12}</span> : null}
      </div>
      <div className="text-xs text-muted">
        Essas funções alimentam o dropdown dos pontos focais (AM, Apoio Técnico, Contratos…).
      </div>
    </div>
  )
}

function AddFocalForm({
  partnerId,
  roles,
  onAdd,
  loading,
}: {
  partnerId: string
  roles: PartnerRole[]
  onAdd: (partnerId: string, payload: Partial<PartnerFocalPoint>) => Promise<void>
  loading: boolean
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [department, setDepartment] = useState("")
  const [roleId, setRoleId] = useState<string>("")
  const [isPrimary, setIsPrimary] = useState(false)

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-3">
      <div className="text-xs text-muted">Adicionar ponto focal</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Nome"
        />
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">Sem função</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Email (opcional)"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Telefone (opcional)"
        />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm md:col-span-2"
          placeholder="Departamento / Subdivisão (opcional)"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
        Marcar como ponto focal principal
      </label>
      <button
        type="button"
        disabled={loading || !name.trim()}
        onClick={async () => {
          await onAdd(partnerId, {
            name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            department: department.trim() || null,
            role_id: roleId || null,
            is_primary: isPrimary,
          })
          setName("")
          setEmail("")
          setPhone("")
          setDepartment("")
          setRoleId("")
          setIsPrimary(false)
        }}
        className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black w-full disabled:opacity-60"
      >
        Adicionar
      </button>
    </div>
  )
}

function PartnerCatalog({ partnerId }: { partnerId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [nodes, setNodes] = useState<CatalogNode[]>([])
  const [items, setItems] = useState<CatalogItem[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // gestão de categoria (node)
  const [nodeDraftName, setNodeDraftName] = useState("")
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteChoice, setDeleteChoice] = useState<"move_existing" | "move_new" | "move_uncategorized">("move_existing")
  const [targetExistingNodeId, setTargetExistingNodeId] = useState<string>("")
  const [targetNewNodeName, setTargetNewNodeName] = useState<string>("")

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId])
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId])

  const reload = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const [{ data: nodeData, error: nErr }, { data: itemData, error: iErr }] = await Promise.all([
        supabase
          .from("partner_catalog_nodes")
          .select("*")
          .eq("partner_id", partnerId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("partner_catalog_items")
          .select("*, articles:partner_catalog_item_articles(*)")
          .eq("partner_id", partnerId)
          .order("created_at", { ascending: false }),
      ])
      if (nErr) throw nErr
      if (iErr) throw iErr
      setNodes(nodeData ?? [])
      setItems((itemData ?? []).map((x: any) => ({ ...x, tags: Array.isArray(x.tags) ? x.tags : [] })))
      if (!selectedNodeId && (nodeData?.[0]?.id ?? null)) setSelectedNodeId(nodeData?.[0]?.id ?? null)
      const sel = (nodeData ?? []).find((n: any) => n.id === (selectedNodeId ?? (nodeData?.[0]?.id ?? null)))
      if (sel) setNodeDraftName(sel.name ?? "")
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar catálogo")
    } finally {
      setLoading(false)
    }
  }

  const descendantsOf = useMemo(() => {
    const byParent = new Map<string | null, CatalogNode[]>()
    for (const n of nodes) {
      const k = n.parent_id ?? null
      byParent.set(k, [...(byParent.get(k) ?? []), n])
    }
    return (rootId: string): string[] => {
      const out: string[] = []
      const stack = [rootId]
      while (stack.length) {
        const id = stack.pop()!
        out.push(id)
        for (const child of byParent.get(id) ?? []) stack.push(child.id)
      }
      return out
    }
  }, [nodes])

  const ensureSemCategoria = async (): Promise<string> => {
    const existing = nodes.find(
      (n) => n.partner_id === partnerId && (n.name ?? "").trim().toLowerCase() === "sem categoria"
    )
    if (existing) return existing.id
    const { data, error } = await supabase
      .from("partner_catalog_nodes")
      .insert({ partner_id: partnerId, parent_id: null, name: "Sem categoria", description: null, sort_order: 9999 })
      .select("id")
      .single()
    if (error) throw error
    return data.id as string
  }

  const renameSelectedNode = async () => {
    if (!selectedNodeId) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const name = nodeDraftName.trim()
      if (!name) throw new Error("Nome da categoria é obrigatório.")
      const { error } = await supabase
        .from("partner_catalog_nodes")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", selectedNodeId)
      if (error) throw error
      setMessage("Categoria atualizada.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao renomear categoria")
    } finally {
      setLoading(false)
    }
  }

  const deleteSelectedNodeSafely = async () => {
    if (!selectedNodeId) return
    if ((selectedNode?.name ?? "").trim().toLowerCase() === "sem categoria") {
      setError("A categoria “Sem categoria” não pode ser removida.")
      return
    }
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const nodeIds = descendantsOf(selectedNodeId)
      const affected = items.filter((it) => nodeIds.includes(it.node_id))

      if (affected.length) {
        let targetNodeId: string
        if (deleteChoice === "move_existing") {
          if (!targetExistingNodeId) throw new Error("Selecione a nova categoria de destino.")
          targetNodeId = targetExistingNodeId
        } else if (deleteChoice === "move_new") {
          const name = targetNewNodeName.trim()
          if (!name) throw new Error("Informe o nome da nova categoria.")
          const { data, error } = await supabase
            .from("partner_catalog_nodes")
            .insert({ partner_id: partnerId, parent_id: null, name, description: null, sort_order: 0 })
            .select("id")
            .single()
          if (error) throw error
          targetNodeId = data.id as string
        } else {
          targetNodeId = await ensureSemCategoria()
        }

        const { error: uErr } = await supabase
          .from("partner_catalog_items")
          .update({ node_id: targetNodeId, updated_at: new Date().toISOString() })
          .in("node_id", nodeIds)
        if (uErr) throw uErr
      }

      const { error: dErr } = await supabase.from("partner_catalog_nodes").delete().eq("id", selectedNodeId)
      if (dErr) throw dErr

      setSelectedNodeId(null)
      setSelectedItemId(null)
      setDeleteMode(false)
      setMessage("Categoria removida.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao remover categoria")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId])

  const nodeTree = useMemo(() => {
    const byParent = new Map<string | null, CatalogNode[]>()
    for (const n of nodes) {
      const k = n.parent_id ?? null
      byParent.set(k, [...(byParent.get(k) ?? []), n])
    }
    return { byParent }
  }, [nodes])

  const visibleItems = useMemo(() => {
    if (!selectedNodeId) return items
    const ids = new Set(descendantsOf(selectedNodeId))
    return items.filter((i) => ids.has(i.node_id))
  }, [items, selectedNodeId, descendantsOf])

  const createNode = async (payload: Partial<CatalogNode>) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("partner_catalog_nodes").insert({
        partner_id: partnerId,
        parent_id: payload.parent_id ?? null,
        name: payload.name,
        description: payload.description ?? null,
        sort_order: payload.sort_order ?? 0,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar categoria")
    } finally {
      setLoading(false)
    }
  }

  const createItem = async (payload: Partial<CatalogItem>) => {
    setError(null)
    setLoading(true)
    try {
      if (!payload.node_id) throw new Error("Selecione uma categoria")
      const { error } = await supabase.from("partner_catalog_items").insert({
        partner_id: partnerId,
        node_id: payload.node_id,
        kind: payload.kind ?? "service",
        name: payload.name,
        description: payload.description ?? null,
        tags: payload.tags ?? [],
        active: true,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar item")
    } finally {
      setLoading(false)
    }
  }

  const uploadItemImage = async (itemId: string, file: File) => {
    setError(null)
    setLoading(true)
    try {
      const path = `partner/${partnerId}/items/${itemId}/${Date.now()}-${safeStorageFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from("partner-assets").upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("partner-assets").getPublicUrl(path)
      const { error } = await supabase
        .from("partner_catalog_items")
        .update({ image_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", itemId)
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar imagem")
    } finally {
      setLoading(false)
    }
  }

  const addArticle = async (itemId: string, title: string, content: string) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("partner_catalog_item_articles").insert({
        item_id: itemId,
        title: title.trim(),
        content,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar artigo")
    } finally {
      setLoading(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm("Remover este item do catálogo?")) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("partner_catalog_items").delete().eq("id", itemId)
      if (error) throw error
      setSelectedItemId(null)
      setMessage("Item removido.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao remover item")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Catálogo (hierarquia)</div>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {error ? <div className="text-sm text-danger">{error}</div> : null}
      {message ? <div className="text-sm text-muted">{message}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="space-y-3">
          <div className="text-xs text-muted">Categorias</div>
          <CatalogNodeCreate nodes={nodes} selectedNodeId={selectedNodeId} onCreate={createNode} loading={loading} />
          {selectedNode ? (
            <details className="rounded-md border border-border bg-background p-3">
              <summary className="cursor-pointer text-sm font-medium">Gerenciar categoria</summary>
              <div className="mt-3 space-y-2">
                <label className="block space-y-1">
                  <div className="text-xs text-muted">Nome</div>
                  <input
                    value={nodeDraftName}
                    onChange={(e) => setNodeDraftName(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading || !selectedNodeId}
                    onClick={renameSelectedNode}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    disabled={loading || !selectedNodeId}
                    onClick={() => {
                      setDeleteMode((v) => !v)
                      setDeleteChoice("move_existing")
                      setTargetExistingNodeId("")
                      setTargetNewNodeName("")
                    }}
                    className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger hover:border-danger/60 disabled:opacity-60"
                  >
                    Remover…
                  </button>
                </div>

                {deleteMode ? (
                  <div className="rounded-md border border-border bg-surface p-3 space-y-3">
                    <div className="text-xs text-muted">
                      Se houver itens nessa categoria (ou subcategorias), escolha o destino antes de remover.
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name="deleteChoice"
                          checked={deleteChoice === "move_existing"}
                          onChange={() => setDeleteChoice("move_existing")}
                        />
                        <span>Indicar a nova categoria já existente</span>
                      </label>
                      {deleteChoice === "move_existing" ? (
                        <select
                          value={targetExistingNodeId}
                          onChange={(e) => setTargetExistingNodeId(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Selecione…</option>
                          {nodes
                            .filter((n) => n.partner_id === partnerId && n.id !== selectedNodeId)
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                        </select>
                      ) : null}

                      <label className="flex items-start gap-2 text-sm">
                        <input type="radio" name="deleteChoice" checked={deleteChoice === "move_new"} onChange={() => setDeleteChoice("move_new")} />
                        <span>Cadastrar uma nova categoria</span>
                      </label>
                      {deleteChoice === "move_new" ? (
                        <input
                          value={targetNewNodeName}
                          onChange={(e) => setTargetNewNodeName(e.target.value)}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Nome da nova categoria"
                        />
                      ) : null}

                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name="deleteChoice"
                          checked={deleteChoice === "move_uncategorized"}
                          onChange={() => setDeleteChoice("move_uncategorized")}
                        />
                        <span>Deixar sem categoria (criar/usar “Sem categoria”)</span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteMode(false)}
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20"
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedNodeSafely}
                        className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger hover:border-danger/60 disabled:opacity-60"
                        disabled={loading}
                      >
                        Confirmar remoção
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
          <div className="rounded-md border border-border bg-background p-2 space-y-1">
            <NodeTree
              byParent={nodeTree.byParent}
              parentId={null}
              selectedNodeId={selectedNodeId}
              onSelect={(id) => {
                setSelectedNodeId(id)
                setSelectedItemId(null)
                const n = nodes.find((x) => x.id === id)
                setNodeDraftName(n?.name ?? "")
                setDeleteMode(false)
              }}
            />
          </div>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="text-xs text-muted">Itens</div>
          <CatalogItemCreate nodeId={selectedNodeId} onCreate={createItem} loading={loading} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleItems.map((it) => (
              <button
                type="button"
                key={it.id}
                onClick={() => setSelectedItemId(it.id)}
                className={
                  "rounded-md border border-border bg-background p-3 text-left hover:border-foreground/20 " +
                  (selectedItemId === it.id ? "ring-2 ring-[hsl(var(--accent))]" : "")
                }
              >
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-md border border-border bg-surface overflow-hidden shrink-0">
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted truncate">
                      {(it.kind === "product" ? "Produto" : "Serviço") + (it.description ? ` • ${it.description}` : "")}
                    </div>
                    <div className="mt-2">
                      <a
                        href={`/catalogo/${it.id}`}
                        className="text-xs underline text-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Abrir página completa
                      </a>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(it.tags ?? []).slice(0, 6).map((t) => (
                        <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {!visibleItems.length ? <div className="text-xs text-muted">Nenhum item nesta categoria.</div> : null}
          </div>

          {selectedItem ? (
            <CatalogItemDetails
              item={selectedItem}
              onUploadImage={uploadItemImage}
              onAddArticle={addArticle}
              onDelete={deleteItem}
              loading={loading}
            />
          ) : (
            <div className="text-xs text-muted">Selecione um item para ver detalhes e artigos.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function NodeTree({
  byParent,
  parentId,
  selectedNodeId,
  onSelect,
  depth = 0,
}: {
  byParent: Map<string | null, CatalogNode[]>
  parentId: string | null
  selectedNodeId: string | null
  onSelect: (id: string) => void
  depth?: number
}) {
  const children = byParent.get(parentId) ?? []
  return (
    <>
      {children.map((n) => (
        <div key={n.id}>
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className={
              "w-full text-left rounded px-2 py-1 text-sm hover:bg-surface " +
              (selectedNodeId === n.id ? "bg-surface border border-border" : "")
            }
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {n.name}
          </button>
          <NodeTree
            byParent={byParent}
            parentId={n.id}
            selectedNodeId={selectedNodeId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        </div>
      ))}
    </>
  )
}

function CatalogNodeCreate({
  nodes,
  selectedNodeId,
  onCreate,
  loading,
}: {
  nodes: CatalogNode[]
  selectedNodeId: string | null
  onCreate: (payload: Partial<CatalogNode>) => Promise<void>
  loading: boolean
}) {
  const [name, setName] = useState("")
  const [parent, setParent] = useState<string>("")
  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="text-xs text-muted">Nova categoria</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        placeholder="ex.: Serviços"
      />
      <select
        value={parent}
        onChange={(e) => setParent(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      >
        <option value="">Sem pai (nível raiz)</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
        {selectedNodeId ? (
          <option value={selectedNodeId}>Usar selecionada como pai</option>
        ) : null}
      </select>
      <button
        type="button"
        disabled={loading || !name.trim()}
        onClick={async () => {
          await onCreate({ name: name.trim(), parent_id: parent || null })
          setName("")
          setParent("")
        }}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        Criar categoria
      </button>
    </div>
  )
}

function CatalogItemCreate({
  nodeId,
  onCreate,
  loading,
}: {
  nodeId: string | null
  onCreate: (payload: Partial<CatalogItem>) => Promise<void>
  loading: boolean
}) {
  const [kind, setKind] = useState<"product" | "service">("service")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>([])

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="text-xs text-muted">Novo item</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as any)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="service">Serviço</option>
          <option value="product">Produto</option>
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="md:col-span-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Nome"
        />
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        placeholder="Descrição (curta)"
      />
      <div>
        <div className="text-xs text-muted mb-1">Tags</div>
        <TagInput value={tags} onChange={setTags} placeholder="Ex.: compliance, BPO, jurídico…" />
      </div>
      <button
        type="button"
        disabled={loading || !name.trim() || !nodeId}
        onClick={async () => {
          await onCreate({
            node_id: nodeId!,
            kind,
            name: name.trim(),
            description: description.trim() || null,
            tags,
          })
          setName("")
          setDescription("")
          setTags([])
        }}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
        title={!nodeId ? "Selecione uma categoria primeiro" : ""}
      >
        Criar item
      </button>
    </div>
  )
}

function CatalogItemDetails({
  item,
  onUploadImage,
  onAddArticle,
  onDelete,
  loading,
}: {
  item: CatalogItem
  onUploadImage: (itemId: string, file: File) => Promise<void>
  onAddArticle: (itemId: string, title: string, content: string) => Promise<void>
  onDelete: (itemId: string) => Promise<void>
  loading: boolean
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const supabase = useMemo(() => createClient(), [])
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
  const [savingMed, setSavingMed] = useState(false)

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium">Detalhes: {item.name}</div>
        <details className="rounded-md border border-border bg-surface p-2">
          <summary className="cursor-pointer text-xs font-medium">Mais ações</summary>
          <div className="mt-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => onDelete(item.id)}
              className="w-full rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:border-danger/60 disabled:opacity-60"
            >
              Remover item
            </button>
          </div>
        </details>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted">Imagem de identificação</div>
        <input
          type="file"
          accept="image/*"
          disabled={loading}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            await onUploadImage(item.id, file)
            e.target.value = ""
          }}
          className="text-xs"
        />
        {item.image_url ? (
          <a className="text-xs underline text-muted" href={item.image_url} target="_blank">
            Abrir imagem
          </a>
        ) : null}
      </div>

      <details className="rounded-md border border-border bg-surface p-2">
        <summary className="text-sm cursor-pointer">MEDDPICC (por item)</summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
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
        </div>
        <button
          type="button"
          disabled={loading || savingMed}
          onClick={async () => {
            setSavingMed(true)
            await supabase
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
            setSavingMed(false)
          }}
          className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
        >
          Salvar MEDDPICC
        </button>
      </details>

      <div className="pt-2 border-t border-border space-y-2">
        <div className="text-sm font-medium">Artigos (internos)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Título do artigo"
          />
          <button
            type="button"
            disabled={loading || !title.trim() || !content.trim()}
            onClick={async () => {
              await onAddArticle(item.id, title, content)
              setTitle("")
              setContent("")
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
          >
            Adicionar artigo
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm min-h-28"
          placeholder="Conteúdo (markdown ou texto simples)"
        />

        <div className="space-y-2">
          {(item.articles ?? [])
            .slice()
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .map((a) => (
              <details key={a.id} className="rounded-md border border-border bg-surface p-2">
                <summary className="text-sm cursor-pointer">{a.title}</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{a.content}</pre>
              </details>
            ))}
          {!item.articles?.length ? <div className="text-xs text-muted">Nenhum artigo ainda.</div> : null}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <div className="text-[11px] text-muted">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-16"
      />
    </label>
  )
}

function PartnerMaterials({ partnerId }: { partnerId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<PartnerMaterial[]>([])
  const [title, setTitle] = useState("")
  const [type, setType] = useState<PartnerMaterial["type"]>("general")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("partner_marketing_materials")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false })
      if (error) throw error
      setItems((data ?? []).map((x: any) => ({ ...x, tags: Array.isArray(x.tags) ? x.tags : [] })))
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar materiais")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId])

  const uploadFile = async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      if (!title.trim()) throw new Error("Informe o título.")
      const path = `partner/${partnerId}/materials/${Date.now()}-${safeStorageFileName(file.name)}`
      const { error: upErr } = await supabase.storage.from("partner-assets").upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("partner-assets").getPublicUrl(path)

      const { error } = await supabase.from("partner_marketing_materials").insert({
        partner_id: partnerId,
        title: title.trim(),
        type,
        storage_path: path,
        public_url: data.publicUrl,
        notes: null,
        tags: [],
      })
      if (error) throw error
      setTitle("")
      setType("general")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar material")
    } finally {
      setLoading(false)
    }
  }

  const addLink = async () => {
    setError(null)
    setLoading(true)
    try {
      if (!title.trim()) throw new Error("Informe o título.")
      if (!url.trim()) throw new Error("Informe a URL.")
      const { error } = await supabase.from("partner_marketing_materials").insert({
        partner_id: partnerId,
        title: title.trim(),
        type: "link",
        storage_path: null,
        public_url: url.trim(),
        notes: null,
        tags: [],
      })
      if (error) throw error
      setTitle("")
      setUrl("")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao adicionar link")
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Remover material?")) return
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("partner_marketing_materials").delete().eq("id", id)
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao remover")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Materiais de divulgação</div>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
        >
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {error ? <div className="text-sm text-danger">{error}</div> : null}

      <div className="rounded-md border border-border bg-background p-3 space-y-2">
        <div className="text-xs text-muted">Adicionar material</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Título (ex.: Apresentação comercial)"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="general">Geral</option>
            <option value="deck">Deck</option>
            <option value="one_pager">One-pager</option>
            <option value="case">Case</option>
            <option value="datasheet">Datasheet</option>
            <option value="video">Vídeo</option>
          </select>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="md:col-span-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            placeholder="URL (opcional) — para links"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            type="file"
            disabled={loading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              await uploadFile(file)
              e.target.value = ""
            }}
            className="text-xs"
          />
          <button
            type="button"
            disabled={loading || !title.trim() || !url.trim()}
            onClick={addLink}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
          >
            Adicionar link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((m) => (
          <div key={m.id} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{m.title}</div>
                <div className="text-xs text-muted">{m.type}</div>
                {m.public_url ? (
                  <a className="text-xs underline text-muted" href={m.public_url} target="_blank">
                    Abrir
                  </a>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-foreground/20"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
        {!items.length ? <div className="text-xs text-muted">Nenhum material cadastrado ainda.</div> : null}
      </div>
    </div>
  )
}
