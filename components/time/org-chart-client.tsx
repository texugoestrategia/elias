"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Position = { id: string; key: string; name: string; description: string | null }
type Member = {
  user_id: string
  email: string
  name: string | null
  position_id: string | null
  manager_user_id: string | null
}

export function OrgChartClient() {
  const supabase = useMemo(() => createClient(), [])
  const [positions, setPositions] = useState<Position[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [view, setView] = useState<"lista" | "organograma">("organograma")
  const [zoom, setZoom] = useState(1)
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [posKey, setPosKey] = useState("")
  const [posName, setPosName] = useState("")

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [positionId, setPositionId] = useState("")
  const [managerEmail, setManagerEmail] = useState("")

  const reload = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const [p, m] = await Promise.all([
        supabase.from("org_positions").select("id,key,name,description").order("name", { ascending: true }),
        supabase.from("org_members").select("user_id,email,name,position_id,manager_user_id"),
      ])
      if (p.error) throw p.error
      if (m.error) throw m.error
      setPositions(p.data ?? [])
      setMembers(m.data ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar organograma")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createPosition = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const key = posKey.trim()
      const nm = posName.trim()
      if (!key || !nm) throw new Error("Preencha key e nome da função/posição.")
      const { error } = await supabase.from("org_positions").insert({ key, name: nm })
      if (error) throw error
      setPosKey("")
      setPosName("")
      setMessage("Função criada.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar função")
    } finally {
      setLoading(false)
    }
  }

  const upsertMember = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const e = email.trim()
      if (!e) throw new Error("Informe o email do colaborador.")

      const { data: uId, error: rpcErr } = await supabase.rpc("user_id_by_email", { p_email: e })
      if (rpcErr) throw rpcErr
      if (!uId) throw new Error("Não encontrei esse usuário no Supabase Auth. Ele precisa ter feito login 1x.")

      let managerId: string | null = null
      const me = managerEmail.trim()
      if (me) {
        const { data: mid, error: mErr } = await supabase.rpc("user_id_by_email", { p_email: me })
        if (mErr) throw mErr
        if (!mid) throw new Error("Não encontrei o gestor pelo email informado.")
        managerId = mid
      }

      const { error } = await supabase.from("org_members").upsert({
        user_id: uId,
        email: e,
        name: name.trim() || null,
        position_id: positionId || null,
        manager_user_id: managerId,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setMessage("Organograma atualizado.")
      setEmail("")
      setName("")
      setPositionId("")
      setManagerEmail("")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar colaborador no organograma")
    } finally {
      setLoading(false)
    }
  }

  const posNameById = useMemo(() => new Map(positions.map((p) => [p.id, p.name])), [positions])

  const tree = useMemo(() => {
    const byManager = new Map<string | null, Member[]>()
    for (const m of members) {
      const k = m.manager_user_id ?? null
      byManager.set(k, [...(byManager.get(k) ?? []), m])
    }
    for (const [k, v] of byManager.entries()) {
      v.sort((a, b) => a.email.localeCompare(b.email))
      byManager.set(k, v)
    }
    return byManager
  }, [members])

  const filteredMembers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => (m.name ?? "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  }, [members, filter])

  const upsertMemberById = async (userId: string, patch: Partial<Member>) => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const current = members.find((m) => m.user_id === userId)
      if (!current) throw new Error("Colaborador não encontrado no organograma.")
      const { error } = await supabase.from("org_members").upsert({
        user_id: userId,
        email: current.email,
        name: current.name,
        position_id: patch.position_id ?? current.position_id,
        manager_user_id: patch.manager_user_id ?? current.manager_user_id,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setMessage("Organograma atualizado.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar organograma")
    } finally {
      setLoading(false)
    }
  }

  const moveManager = async (dragUserId: string, managerUserId: string | null) => {
    if (dragUserId === managerUserId) return
    await upsertMemberById(dragUserId, { manager_user_id: managerUserId })
  }

  const assignPosition = async (dragUserId: string, posId: string | null) => {
    await upsertMemberById(dragUserId, { position_id: posId })
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Organograma
        </h2>
        <p className="text-sm text-muted">
          Cadastre funções e subordinação (quem responde a quem). Supervisores herdam acesso dos subordinados via RBAC.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-medium">Funções (posições)</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={posKey}
              onChange={(e) => setPosKey(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="key (ex.: supervisor)"
            />
            <input
              value={posName}
              onChange={(e) => setPosName(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Nome (ex.: Supervisor)"
            />
          </div>
          <button
            type="button"
            onClick={createPosition}
            disabled={loading}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            Criar função
          </button>
          <div className="flex flex-wrap gap-2">
            {positions.map((p) => (
              <span key={p.id} className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted">
                {p.name}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-medium">Vínculo (colaborador → gestor)</div>
          <div className="space-y-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Email do colaborador (login do Supabase)"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Nome (opcional)"
            />
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Sem função</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Email do gestor (opcional)"
            />
          </div>
          <button
            type="button"
            onClick={upsertMember}
            disabled={loading}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            Salvar vínculo
          </button>
          <div className="text-xs text-muted">
            Dica: o usuário precisa ter feito login ao menos 1x para existir no Supabase Auth.
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Visualização</div>
            <button
              type="button"
              onClick={() => setView("organograma")}
              className={
                "rounded-md border border-border px-3 py-1.5 text-xs " +
                (view === "organograma" ? "bg-background" : "bg-surface hover:border-foreground/20")
              }
            >
              Organograma
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={
                "rounded-md border border-border px-3 py-1.5 text-xs " +
                (view === "lista" ? "bg-background" : "bg-surface hover:border-foreground/20")
              }
            >
              Lista
            </button>
          </div>
          <div className="flex items-center gap-2">
            {view === "organograma" ? (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:border-foreground/20"
                  title="Diminuir zoom"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:border-foreground/20"
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:border-foreground/20"
                  title="Aumentar zoom"
                >
                  +
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20 disabled:opacity-60"
            >
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            {view === "lista" ? (
              <OrgTree byManager={tree} managerId={null} posNameById={posNameById} depth={0} />
            ) : (
              <OrgChartVisual
                byManager={tree}
                managerId={null}
                posNameById={posNameById}
                zoom={zoom}
                onDropManager={moveManager}
              />
            )}
          </div>

          <aside className="rounded-lg border border-border bg-background p-3 space-y-3">
            <div className="text-sm font-medium">Drag & Drop</div>
            <div className="text-xs text-muted">
              Arraste um colaborador para cima de outro (define gestor) ou para uma função (define cargo).
            </div>

            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar por nome/email…"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />

            <div
              className="rounded-md border border-border bg-surface p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const uid = e.dataTransfer.getData("text/plain")
                if (uid) moveManager(uid, null)
              }}
              title="Solte aqui para remover gestor (topo)"
            >
              <div className="text-xs font-medium">Topo (sem gestor)</div>
              <div className="text-[11px] text-muted">Solte aqui para colocar no topo do organograma.</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium">Funções</div>
              <div className="flex flex-wrap gap-2">
                {positions.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-full border border-border bg-surface px-2 py-1 text-xs"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const uid = e.dataTransfer.getData("text/plain")
                      if (uid) assignPosition(uid, p.id)
                    }}
                    title="Solte aqui para atribuir esta função"
                  >
                    {p.name}
                  </div>
                ))}
                <div
                  className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-muted"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const uid = e.dataTransfer.getData("text/plain")
                    if (uid) assignPosition(uid, null)
                  }}
                  title="Solte aqui para remover função"
                >
                  Sem função
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium">Colaboradores</div>
              <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
                {filteredMembers.map((m) => (
                  <div
                    key={m.user_id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", m.user_id)}
                    className="rounded-md border border-border bg-surface px-3 py-2 cursor-grab active:cursor-grabbing"
                    title="Arraste para re-alocar"
                  >
                    <div className="text-sm font-medium">{m.name ?? m.email}</div>
                    <div className="text-[11px] text-muted">{m.email}</div>
                    <div className="text-[11px] text-muted">
                      {m.position_id ? posNameById.get(m.position_id) ?? "—" : "—"}
                    </div>
                  </div>
                ))}
                {!filteredMembers.length ? <div className="text-xs text-muted">Nenhum encontrado.</div> : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function OrgTree({
  byManager,
  managerId,
  posNameById,
  depth,
}: {
  byManager: Map<string | null, Member[]>
  managerId: string | null
  posNameById: Map<string, string>
  depth: number
}) {
  const children = byManager.get(managerId) ?? []
  if (!children.length) return <div className={depth === 0 ? "text-xs text-muted" : ""}>{depth === 0 ? "Sem vínculos ainda." : null}</div>

  return (
    <div className="space-y-2">
      {children.map((m) => (
        <div key={m.user_id} style={{ marginLeft: depth * 16 }}>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-sm font-medium">{m.name ?? m.email}</div>
            <div className="text-xs text-muted">
              {m.email} • {m.position_id ? posNameById.get(m.position_id) ?? "—" : "—"}
            </div>
          </div>
          <OrgTree byManager={byManager} managerId={m.user_id} posNameById={posNameById} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

function OrgChartVisual({
  byManager,
  managerId,
  posNameById,
  zoom,
  onDropManager,
}: {
  byManager: Map<string | null, Member[]>
  managerId: string | null
  posNameById: Map<string, string>
  zoom: number
  onDropManager: (dragUserId: string, managerUserId: string | null) => void
}) {
  const roots = byManager.get(managerId) ?? []
  if (!roots.length) return <div className="text-xs text-muted">Sem vínculos ainda.</div>

  return (
    <div className="orgchart-wrap">
      <style jsx global>{`
        .orgchart-wrap {
          overflow: auto;
          padding: 8px;
        }
        .orgchart {
          display: inline-block;
          min-width: 100%;
        }
        .orgchart ul {
          padding-top: 20px;
          position: relative;
          transition: all 0.2s;
          display: flex;
          justify-content: center;
          gap: 24px;
        }
        .orgchart li {
          list-style-type: none;
          text-align: center;
          position: relative;
          padding: 20px 8px 0 8px;
        }
        /* linhas horizontais */
        .orgchart li::before,
        .orgchart li::after {
          content: "";
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 1px solid hsl(var(--border));
          width: 50%;
          height: 20px;
        }
        .orgchart li::after {
          right: auto;
          left: 50%;
          border-left: 1px solid hsl(var(--border));
        }
        .orgchart li:only-child::after,
        .orgchart li:only-child::before {
          display: none;
        }
        .orgchart li:only-child {
          padding-top: 0;
        }
        .orgchart li:first-child::before,
        .orgchart li:last-child::after {
          border: 0 none;
        }
        .orgchart li:last-child::before {
          border-right: 1px solid hsl(var(--border));
          border-radius: 0 6px 0 0;
        }
        .orgchart li:first-child::after {
          border-radius: 6px 0 0 0;
        }
        /* linha vertical para filhos */
        .orgchart ul ul::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 1px solid hsl(var(--border));
          width: 0;
          height: 20px;
        }
        .orgchart .node {
          display: inline-block;
          padding: 10px 12px;
          min-width: 220px;
          border: 1px solid hsl(var(--border));
          border-radius: 10px;
          background: hsl(var(--background));
        }
        .orgchart .node .title {
          font-size: 14px;
          font-weight: 600;
          color: hsl(var(--text-primary));
          line-height: 1.2;
        }
        .orgchart .node .sub {
          margin-top: 4px;
          font-size: 12px;
          color: hsl(var(--text-secondary));
        }
      `}</style>

      <div className="orgchart" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
        <ul>
          {roots.map((m) => (
            <OrgChartNode
              key={m.user_id}
              m={m}
              byManager={byManager}
              posNameById={posNameById}
              onDropManager={onDropManager}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

function OrgChartNode({
  m,
  byManager,
  posNameById,
  onDropManager,
}: {
  m: Member
  byManager: Map<string | null, Member[]>
  posNameById: Map<string, string>
  onDropManager: (dragUserId: string, managerUserId: string | null) => void
}) {
  const children = byManager.get(m.user_id) ?? []
  return (
    <li>
      <div
        className="node"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const uid = e.dataTransfer.getData("text/plain")
          if (uid) onDropManager(uid, m.user_id)
        }}
        title="Solte aqui para definir este usuário como gestor"
      >
        <div className="title">{m.name ?? m.email}</div>
        <div className="sub">
          {m.position_id ? posNameById.get(m.position_id) ?? "—" : "—"} • {m.email}
        </div>
      </div>
      {children.length ? (
        <ul>
          {children.map((c) => (
            <OrgChartNode key={c.user_id} m={c} byManager={byManager} posNameById={posNameById} onDropManager={onDropManager} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
