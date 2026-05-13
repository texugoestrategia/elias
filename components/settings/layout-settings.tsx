"use client"

import { useMemo, useState } from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { createClient } from "@/lib/supabase/client"
import { SortableRow, type SortableItem } from "@/components/settings/sortable-list"
import { CollapsibleSection } from "@/components/ui/collapsible-section"

type LayoutValue = { order: string[]; hidden: string[] }

function normalizeLayout(items: SortableItem[], raw: any | null): LayoutValue {
  const ids = items.map((i) => i.id)
  const order = Array.isArray(raw?.order) ? raw.order.filter((x: any) => ids.includes(x)) : []
  const hidden = Array.isArray(raw?.hidden) ? raw.hidden.filter((x: any) => ids.includes(x)) : []

  // append any new items not in order
  for (const id of ids) if (!order.includes(id)) order.push(id)

  return { order, hidden }
}

export function LayoutSettings({
  sidebarItems,
  dashboardItems,
  initialSidebar,
  initialDashboard,
}: {
  sidebarItems: SortableItem[]
  dashboardItems: SortableItem[]
  initialSidebar: any | null
  initialDashboard: any | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [sidebar, setSidebar] = useState<LayoutValue>(() => normalizeLayout(sidebarItems, initialSidebar))
  const [dash, setDash] = useState<LayoutValue>(() => normalizeLayout(dashboardItems, initialDashboard))

  const saveKey = async (key: string, value: LayoutValue) => {
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!authData.user) throw new Error("Não autenticado")

      const { error } = await supabase.from("user_layouts").upsert(
        {
          user_id: authData.user.id,
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" }
      )
      if (error) throw error
      setMsg("Layout salvo.")
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao salvar layout")
    } finally {
      setSaving(false)
    }
  }

  const onDragEnd =
    (kind: "sidebar" | "dashboard") =>
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      if (kind === "sidebar") {
        const oldIndex = sidebar.order.indexOf(String(active.id))
        const newIndex = sidebar.order.indexOf(String(over.id))
        const next = { ...sidebar, order: arrayMove(sidebar.order, oldIndex, newIndex) }
        setSidebar(next)
        void saveKey("sidebar", next)
      } else {
        const oldIndex = dash.order.indexOf(String(active.id))
        const newIndex = dash.order.indexOf(String(over.id))
        const next = { ...dash, order: arrayMove(dash.order, oldIndex, newIndex) }
        setDash(next)
        void saveKey("dashboard.shortcuts", next)
      }
    }

  const toggleHidden = (kind: "sidebar" | "dashboard", id: string) => {
    const state = kind === "sidebar" ? sidebar : dash
    const hidden = new Set(state.hidden)
    if (hidden.has(id)) hidden.delete(id)
    else hidden.add(id)
    const next = { ...state, hidden: Array.from(hidden) }

    if (kind === "sidebar") {
      setSidebar(next)
      void saveKey("sidebar", next)
    } else {
      setDash(next)
      void saveKey("dashboard.shortcuts", next)
    }
  }

  const reset = async () => {
    const sidebarDefault = normalizeLayout(sidebarItems, { order: sidebarItems.map((i) => i.id), hidden: [] })
    const dashDefault = normalizeLayout(dashboardItems, { order: dashboardItems.map((i) => i.id), hidden: [] })
    setSidebar(sidebarDefault)
    setDash(dashDefault)
    await saveKey("sidebar", sidebarDefault)
    await saveKey("dashboard.shortcuts", dashDefault)
  }

  const orderedSidebarItems = useMemo(
    () => sidebar.order.map((id) => sidebarItems.find((i) => i.id === id)!).filter(Boolean),
    [sidebar.order, sidebarItems]
  )
  const orderedDashItems = useMemo(
    () => dash.order.map((id) => dashboardItems.find((i) => i.id === id)!).filter(Boolean),
    [dash.order, dashboardItems]
  )

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Layout (drag & drop)
        </h1>
        <p className="text-sm text-muted">
          Reordene e oculte seções sem comprometer a experiência. Arraste pelo “⋮⋮”.
        </p>
      </header>

      {err ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{err}</div>
      ) : null}
      {msg ? (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{msg}</div>
      ) : null}

      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">Mais ações</summary>
        <div className="mt-3">
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-foreground/20 disabled:opacity-60"
          >
            Resetar layout
          </button>
        </div>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollapsibleSection title="Sidebar" description="Reordene e oculte entradas. Arraste pelo “⋮⋮”." defaultOpen>
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd("sidebar")}>
            <SortableContext items={sidebar.order} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderedSidebarItems.map((it) => (
                  <SortableRow
                    key={it.id}
                    item={it}
                    hidden={sidebar.hidden.includes(it.id)}
                    onToggleHidden={(id) => toggleHidden("sidebar", id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CollapsibleSection>

        <CollapsibleSection title="Dashboard (atalhos)" description="Atalhos do dashboard inicial." defaultOpen={false}>
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd("dashboard")}>
            <SortableContext items={dash.order} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderedDashItems.map((it) => (
                  <SortableRow
                    key={it.id}
                    item={it}
                    hidden={dash.hidden.includes(it.id)}
                    onToggleHidden={(id) => toggleHidden("dashboard", id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CollapsibleSection>
      </div>
    </div>
  )
}
