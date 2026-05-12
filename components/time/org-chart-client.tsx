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
          <div className="text-sm font-medium">Visualização</div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20 disabled:opacity-60"
          >
            Atualizar
          </button>
        </div>
        <OrgTree byManager={tree} managerId={null} posNameById={posNameById} depth={0} />
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

