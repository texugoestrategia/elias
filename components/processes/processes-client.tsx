"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import * as Tabs from "@radix-ui/react-tabs"
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  BarChart,
} from "recharts"

type ProcessArea = {
  id: string
  name: string
}

type Process = {
  id: string
  area_id: string | null
  parent_id: string | null
  code: string | null
  name: string
  macro_summary: string | null
  macro_kpis_summary: string | null
  micro_description: string | null
  what: string | null
  why: string | null
  where_: string | null
  who: string | null
  when_: string | null
  how: string | null
  active: boolean
  created_at: string
  updated_at: string
}

type ProcessFile = {
  id: string
  process_id: string
  kind: "bpmn" | "dep" | "raci" | "other"
  filename: string
  mime_type: string | null
  file_url: string
  version: number
  is_current: boolean
  uploaded_at: string
}

type KPI = {
  id: string
  process_id: string
  name: string
  unit: string | null
  direction: "higher_is_better" | "lower_is_better"
  target: number | null
  warning_threshold: number | null
  critical_threshold: number | null
}

type KPIValue = {
  id: string
  kpi_id: string
  date: string
  value: number
}

export function ProcessesClient({
  initialAreas,
  initialProcesses,
}: {
  initialAreas: ProcessArea[]
  initialProcesses: Process[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [areas, setAreas] = useState(initialAreas)
  const [processes, setProcesses] = useState(initialProcesses)
  const [selectedId, setSelectedId] = useState<string | null>(initialProcesses[0]?.id ?? null)

  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => processes.find((p) => p.id === selectedId) ?? null, [processes, selectedId])

  const reload = async () => {
    setError(null)
    setLoading(true)
    try {
      const [{ data: a, error: ae }, { data: p, error: pe }] = await Promise.all([
        supabase.from("process_areas").select("id,name").order("name", { ascending: true }),
        supabase.from("processes").select("*").order("name", { ascending: true }),
      ])
      if (ae) throw ae
      if (pe) throw pe
      setAreas(a ?? [])
      setProcesses(p ?? [])
      if (!selectedId && (p?.[0]?.id ?? null)) setSelectedId(p?.[0]?.id ?? null)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar processos")
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
    if (!term) return processes
    return processes.filter((p) => {
      const hay = [
        p.code ?? "",
        p.name,
        p.macro_summary ?? "",
        p.micro_description ?? "",
        p.what ?? "",
        p.why ?? "",
        p.where_ ?? "",
        p.who ?? "",
        p.when_ ?? "",
        p.how ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(term)
    })
  }, [processes, q])

  const tree = useMemo(() => {
    const byParent = new Map<string | null, Process[]>()
    for (const p of filtered) {
      const key = p.parent_id ?? null
      byParent.set(key, [...(byParent.get(key) ?? []), p])
    }
    // sort
    for (const [k, v] of byParent.entries()) {
      v.sort((a, b) => a.name.localeCompare(b.name))
      byParent.set(k, v)
    }
    return byParent
  }, [filtered])

  const createProcess = async (payload: Partial<Process>) => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("processes")
        .insert({
          name: payload.name,
          code: payload.code ?? null,
          area_id: payload.area_id ?? null,
          parent_id: payload.parent_id ?? null,
          macro_summary: payload.macro_summary ?? null,
          micro_description: payload.micro_description ?? null,
          active: true,
        })
        .select("*")
        .single()
      if (error) throw error
      await reload()
      setSelectedId(data.id)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar processo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Processos
          </h1>
          <p className="text-sm text-muted">
            Visão Macro e Micro, anexos versionados (BPMN/DEP/RACI) e KPIs com histórico.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-1 space-y-3">
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar processo…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="text-xs text-muted">{filtered.length} processo(s)</div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="text-sm font-medium">Novo processo</div>
            <CreateProcessForm
              areas={areas}
              parentId={selected?.id ?? null}
              onCreate={createProcess}
              loading={loading}
            />
            <div className="text-xs text-muted">
              Dica: deixe o “pai” como o processo selecionado para montar a hierarquia.
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-2">
            <ProcessTree byParent={tree} parentId={null} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          {selected ? (
            <ProcessDetails process={selected} areas={areas} onSaved={reload} />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
              Selecione um processo para ver detalhes.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ProcessTree({
  byParent,
  parentId,
  selectedId,
  onSelect,
  depth = 0,
}: {
  byParent: Map<string | null, Process[]>
  parentId: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  depth?: number
}) {
  const children = byParent.get(parentId) ?? []
  return (
    <>
      {children.map((p) => (
        <div key={p.id}>
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            className={
              "w-full text-left rounded px-2 py-1 text-sm hover:bg-background/50 " +
              (selectedId === p.id ? "bg-background/70 border border-border" : "")
            }
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {p.code ? <span className="text-xs text-muted mr-2">{p.code}</span> : null}
            <span className="font-medium">{p.name}</span>
          </button>
          <ProcessTree
            byParent={byParent}
            parentId={p.id}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        </div>
      ))}
    </>
  )
}

function CreateProcessForm({
  areas,
  parentId,
  onCreate,
  loading,
}: {
  areas: ProcessArea[]
  parentId: string | null
  onCreate: (payload: Partial<Process>) => Promise<void>
  loading: boolean
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [areaId, setAreaId] = useState<string>("")
  const [useParent, setUseParent] = useState(true)

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        placeholder="Nome do processo"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Código (opcional)"
        />
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Sem área</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={useParent} onChange={(e) => setUseParent(e.target.checked)} />
        Criar como filho do selecionado
      </label>

      <button
        type="button"
        disabled={loading || !name.trim()}
        onClick={async () => {
          await onCreate({
            name: name.trim(),
            code: code.trim() || null,
            area_id: areaId || null,
            parent_id: useParent ? parentId : null,
          })
          setName("")
          setCode("")
          setAreaId("")
        }}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        Criar
      </button>
    </div>
  )
}

function ProcessDetails({
  process,
  areas,
  onSaved,
}: {
  process: Process
  areas: ProcessArea[]
  onSaved: () => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [draft, setDraft] = useState(process)
  useEffect(() => setDraft(process), [process])

  const save = async (patch: Partial<Process>) => {
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const { error } = await supabase
        .from("processes")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", process.id)
      if (error) throw error
      setMsg("Salvo.")
      await onSaved()
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold truncate">{process.name}</div>
          <div className="text-xs text-muted truncate">{process.code ?? "—"}</div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => save(draft)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {err ? <div className="text-sm text-danger">{err}</div> : null}
      {msg ? <div className="text-xs text-muted">{msg}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="block space-y-1 md:col-span-2">
          <div className="text-xs text-muted">Nome</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <div className="text-xs text-muted">Área</div>
          <select
            value={draft.area_id ?? ""}
            onChange={(e) => setDraft({ ...draft, area_id: e.target.value || null })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sem área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Tabs.Root defaultValue="macro" className="space-y-3">
        <Tabs.List className="flex flex-wrap gap-2">
          <TabTrigger value="macro" label="Visão Macro" />
          <TabTrigger value="micro" label="Visão Micro" />
          <TabTrigger value="files" label="Arquivos" />
          <TabTrigger value="kpis" label="KPIs" />
        </Tabs.List>

        <Tabs.Content value="macro" className="space-y-3">
          <label className="block space-y-1">
            <div className="text-xs text-muted">Mapa geral (resumo)</div>
            <textarea
              value={draft.macro_summary ?? ""}
              onChange={(e) => setDraft({ ...draft, macro_summary: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-24"
            />
          </label>
          <label className="block space-y-1">
            <div className="text-xs text-muted">KPIs resumidos (texto)</div>
            <textarea
              value={draft.macro_kpis_summary ?? ""}
              onChange={(e) => setDraft({ ...draft, macro_kpis_summary: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-20"
            />
          </label>
        </Tabs.Content>

        <Tabs.Content value="micro" className="space-y-3">
          <label className="block space-y-1">
            <div className="text-xs text-muted">Descrição completa</div>
            <textarea
              value={draft.micro_description ?? ""}
              onChange={(e) => setDraft({ ...draft, micro_description: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-24"
            />
          </label>

          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <div className="text-sm font-medium">5W2H (opcional)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Field label="O quê?" value={draft.what ?? ""} onChange={(v) => setDraft({ ...draft, what: v })} />
              <Field label="Por quê?" value={draft.why ?? ""} onChange={(v) => setDraft({ ...draft, why: v })} />
              <Field label="Onde?" value={draft.where_ ?? ""} onChange={(v) => setDraft({ ...draft, where_: v })} />
              <Field label="Quem atua (RACI)?" value={draft.who ?? ""} onChange={(v) => setDraft({ ...draft, who: v })} />
              <Field label="Quando acontece?" value={draft.when_ ?? ""} onChange={(v) => setDraft({ ...draft, when_: v })} />
              <Field label="Como?" value={draft.how ?? ""} onChange={(v) => setDraft({ ...draft, how: v })} />
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="files">
          <ProcessFiles processId={process.id} />
        </Tabs.Content>

        <Tabs.Content value="kpis">
          <ProcessKPIs processId={process.id} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function TabTrigger({ value, label }: { value: string; label: string }) {
  return (
    <Tabs.Trigger
      value={value}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20 data-[state=active]:ring-2 data-[state=active]:ring-[hsl(var(--accent))]"
    >
      {label}
    </Tabs.Trigger>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs text-muted">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />
    </label>
  )
}

function ProcessFiles({ processId }: { processId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [files, setFiles] = useState<ProcessFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("process_files")
        .select("id,process_id,kind,filename,mime_type,file_url,version,is_current,uploaded_at")
        .eq("process_id", processId)
        .order("uploaded_at", { ascending: false })
      if (error) throw error
      setFiles(data ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar arquivos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId])

  const upload = async (kind: ProcessFile["kind"], file: File) => {
    setError(null)
    if (file.size > 20 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 20MB).")
      return
    }

    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id ?? null

      const current = files.filter((f) => f.kind === kind && f.is_current)
      const nextVersion = Math.max(0, ...files.filter((f) => f.kind === kind).map((f) => f.version)) + 1

      const path = `process/${processId}/${kind}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from("process-assets").upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("process-assets").getPublicUrl(path)

      // desmarca atual
      if (current.length) {
        await supabase.from("process_files").update({ is_current: false }).eq("process_id", processId).eq("kind", kind).eq("is_current", true)
      }

      const { error } = await supabase.from("process_files").insert({
        process_id: processId,
        kind,
        filename: file.name,
        mime_type: file.type || null,
        file_path: path,
        file_url: data.publicUrl,
        version: nextVersion,
        is_current: true,
        uploaded_by: userId,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar arquivo")
    } finally {
      setLoading(false)
    }
  }

  const kinds: Array<{ key: ProcessFile["kind"]; label: string; accepts: string }> = [
    { key: "bpmn", label: "BPMN", accepts: "application/pdf,image/*,.bpmn,.xml" },
    { key: "dep", label: "DEP", accepts: "application/pdf,image/*,.xlsx" },
    { key: "raci", label: "RACI", accepts: "application/pdf,image/*,.xlsx" },
    { key: "other", label: "Outros", accepts: "application/pdf,image/*,.xlsx,.xml,.bpmn" },
  ]

  return (
    <div className="space-y-4">
      {error ? <div className="text-sm text-danger">{error}</div> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {kinds.map((k) => {
          const current = files.find((f) => f.kind === k.key && f.is_current) ?? null
          const history = files.filter((f) => f.kind === k.key).sort((a, b) => b.version - a.version)
          return (
            <div key={k.key} className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{k.label}</div>
                <input
                  type="file"
                  accept={k.accepts}
                  disabled={loading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    await upload(k.key, file)
                    e.target.value = ""
                  }}
                  className="text-xs"
                />
              </div>

              {current ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted">
                    Atual: v{current.version} • {current.filename}
                  </div>
                  <InlinePreview url={current.file_url} mime={current.mime_type} />
                  <a className="text-xs underline text-muted" href={current.file_url} target="_blank">
                    Abrir em nova aba
                  </a>
                </div>
              ) : (
                <div className="text-xs text-muted">Nenhum arquivo ainda.</div>
              )}

              {history.length ? (
                <details className="rounded-md border border-border bg-surface p-2">
                  <summary className="text-xs cursor-pointer text-muted">Histórico (versões)</summary>
                  <div className="mt-2 space-y-1">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted">
                          v{h.version} • {new Date(h.uploaded_at).toLocaleDateString()}
                        </span>
                        <a className="underline text-muted" href={h.file_url} target="_blank">
                          abrir
                        </a>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InlinePreview({ url, mime }: { url: string; mime: string | null }) {
  const m = (mime ?? "").toLowerCase()
  if (m.includes("pdf")) {
    return <iframe src={url} className="w-full h-64 rounded-md border border-border bg-surface" />
  }
  if (m.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-full h-64 object-cover rounded-md border border-border bg-surface" />
  }
  if (m.includes("xml") || url.endsWith(".xml") || url.endsWith(".bpmn")) {
    return <div className="text-xs text-muted">Arquivo XML/BPMN: visualize baixando/abrindo em nova aba.</div>
  }
  return <div className="text-xs text-muted">Prévia não disponível para este tipo. Use o link.</div>
}

function ProcessKPIs({ processId }: { processId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [kpis, setKpis] = useState<KPI[]>([])
  const [values, setValues] = useState<Record<string, KPIValue[]>>({})
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setError(null)
    setLoading(true)
    try {
      const { data: k, error: ke } = await supabase.from("process_kpis").select("*").eq("process_id", processId).order("created_at", { ascending: false })
      if (ke) throw ke
      setKpis(k ?? [])
      if (!selectedKpiId && (k?.[0]?.id ?? null)) setSelectedKpiId(k?.[0]?.id ?? null)

      const map: Record<string, KPIValue[]> = {}
      for (const it of k ?? []) {
        const { data: v, error: ve } = await supabase
          .from("process_kpi_values")
          .select("id,kpi_id,date,value")
          .eq("kpi_id", it.id)
          .order("date", { ascending: true })
        if (ve) throw ve
        map[it.id] = (v ?? []).map((x: any) => ({ ...x, value: Number(x.value) }))
      }
      setValues(map)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar KPIs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId])

  const addKpi = async (payload: Partial<KPI>) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("process_kpis").insert({
        process_id: processId,
        name: payload.name,
        unit: payload.unit ?? null,
        direction: payload.direction ?? "higher_is_better",
        target: payload.target ?? null,
        warning_threshold: payload.warning_threshold ?? null,
        critical_threshold: payload.critical_threshold ?? null,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar KPI")
    } finally {
      setLoading(false)
    }
  }

  const addValue = async (kpiId: string, date: string, value: number) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("process_kpi_values").upsert({ kpi_id: kpiId, date, value })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar valor")
    } finally {
      setLoading(false)
    }
  }

  const selected = kpis.find((k) => k.id === selectedKpiId) ?? null
  const series = selected ? values[selected.id] ?? [] : []

  const latestValue = series.length ? series[series.length - 1].value : null
  const traffic = selected ? trafficLight(selected, latestValue) : "unknown"

  return (
    <div className="space-y-4">
      {error ? <div className="text-sm text-danger">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1 space-y-3">
          <div className="text-sm font-medium">KPIs</div>
          <CreateKpiForm onCreate={addKpi} loading={loading} />
          <div className="space-y-2">
            {kpis.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setSelectedKpiId(k.id)}
                className={
                  "w-full text-left rounded-md border border-border bg-background p-3 hover:border-foreground/20 " +
                  (selectedKpiId === k.id ? "ring-2 ring-[hsl(var(--accent))]" : "")
                }
              >
                <div className="text-sm font-medium">{k.name}</div>
                <div className="text-xs text-muted">
                  {k.unit ?? "—"} • {k.direction === "higher_is_better" ? "maior é melhor" : "menor é melhor"}
                </div>
              </button>
            ))}
            {!kpis.length ? <div className="text-xs text-muted">Nenhum KPI ainda.</div> : null}
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          {selected ? (
            <>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{selected.name}</div>
                    <div className="text-xs text-muted">
                      Meta: {selected.target ?? "—"} {selected.unit ?? ""}
                    </div>
                  </div>
                  <div className="text-xs">
                    <span
                      className={
                        "rounded-full border px-2 py-0.5 " +
                        (traffic === "green"
                          ? "border-emerald-500/30 text-emerald-300"
                          : traffic === "yellow"
                            ? "border-amber-500/30 text-amber-300"
                            : traffic === "red"
                              ? "border-rose-500/30 text-rose-300"
                              : "border-border text-muted")
                      }
                    >
                      {traffic === "green"
                        ? "Verde"
                        : traffic === "yellow"
                          ? "Amarelo"
                          : traffic === "red"
                            ? "Vermelho"
                            : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <KpiValueForm onAdd={(date, value) => addValue(selected.id, date, value)} loading={loading} />

              <div className="rounded-md border border-border bg-background p-3 space-y-2">
                <div className="text-xs text-muted">Gráfico</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted">Selecione um KPI para ver detalhes.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function trafficLight(kpi: KPI, current: number | null): "green" | "yellow" | "red" | "unknown" {
  if (current === null || current === undefined) return "unknown"
  const dir = kpi.direction
  const warn = kpi.warning_threshold
  const crit = kpi.critical_threshold
  const target = kpi.target

  // Se thresholds existirem, usa-os; senão tenta usar target como referência simples.
  if (warn != null && crit != null) {
    if (dir === "higher_is_better") {
      if (current < crit) return "red"
      if (current < warn) return "yellow"
      return "green"
    } else {
      if (current > crit) return "red"
      if (current > warn) return "yellow"
      return "green"
    }
  }

  if (target != null) {
    if (dir === "higher_is_better") return current >= target ? "green" : "yellow"
    return current <= target ? "green" : "yellow"
  }

  return "unknown"
}

function CreateKpiForm({ onCreate, loading }: { onCreate: (payload: Partial<KPI>) => Promise<void>; loading: boolean }) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("")
  const [direction, setDirection] = useState<KPI["direction"]>("higher_is_better")
  const [target, setTarget] = useState("")
  const [warn, setWarn] = useState("")
  const [crit, setCrit] = useState("")

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="text-xs text-muted">Novo KPI</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        placeholder="Nome do KPI"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Unidade (%, dias...)"
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as any)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="higher_is_better">Maior é melhor</option>
          <option value="lower_is_better">Menor é melhor</option>
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Meta"
        />
        <input
          value={warn}
          onChange={(e) => setWarn(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Amarelo"
        />
        <input
          value={crit}
          onChange={(e) => setCrit(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Vermelho"
        />
      </div>
      <button
        type="button"
        disabled={loading || !name.trim()}
        onClick={async () => {
          await onCreate({
            name: name.trim(),
            unit: unit.trim() || null,
            direction,
            target: target ? Number(target) : null,
            warning_threshold: warn ? Number(warn) : null,
            critical_threshold: crit ? Number(crit) : null,
          })
          setName("")
          setUnit("")
          setTarget("")
          setWarn("")
          setCrit("")
        }}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        Criar KPI
      </button>
    </div>
  )
}

function KpiValueForm({ onAdd, loading }: { onAdd: (date: string, value: number) => Promise<void>; loading: boolean }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [value, setValue] = useState("")

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="text-xs text-muted">Adicionar valor</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Valor numérico"
        />
      </div>
      <button
        type="button"
        disabled={loading || !date || value === "" || Number.isNaN(Number(value))}
        onClick={async () => {
          await onAdd(date, Number(value))
          setValue("")
        }}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60 w-full"
      >
        Salvar valor
      </button>
    </div>
  )
}
