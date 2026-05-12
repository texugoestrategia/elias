"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Role = { id: string; key: string; name: string; description: string | null }
type Permission = { id: string; key: string; name: string; description: string | null }
type RolePermission = { role_id: string; permission_id: string }

export function RbacClient() {
  const supabase = useMemo(() => createClient(), [])
  const [roles, setRoles] = useState<Role[]>([])
  const [perms, setPerms] = useState<Permission[]>([])
  const [links, setLinks] = useState<RolePermission[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [newRoleKey, setNewRoleKey] = useState("")
  const [newRoleName, setNewRoleName] = useState("")
  const [newPermKey, setNewPermKey] = useState("")
  const [newPermName, setNewPermName] = useState("")

  const reload = async () => {
    setError(null)
    setLoading(true)
    try {
      const [r, p, rp] = await Promise.all([
        supabase.from("app_roles").select("id,key,name,description").order("key", { ascending: true }),
        supabase.from("app_permissions").select("id,key,name,description").order("key", { ascending: true }),
        supabase.from("role_permissions").select("role_id,permission_id"),
      ])
      if (r.error) throw r.error
      if (p.error) throw p.error
      if (rp.error) throw rp.error
      setRoles(r.data ?? [])
      setPerms(p.data ?? [])
      setLinks(rp.data ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar RBAC")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createRole = async () => {
    setError(null)
    setLoading(true)
    try {
      const key = newRoleKey.trim()
      const name = newRoleName.trim()
      if (!key || !name) throw new Error("Preencha key e nome do role")
      const { error } = await supabase.from("app_roles").insert({ key, name })
      if (error) throw error
      setNewRoleKey("")
      setNewRoleName("")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar role")
    } finally {
      setLoading(false)
    }
  }

  const createPerm = async () => {
    setError(null)
    setLoading(true)
    try {
      const key = newPermKey.trim()
      const name = newPermName.trim()
      if (!key || !name) throw new Error("Preencha key e nome da permissão")
      const { error } = await supabase.from("app_permissions").insert({ key, name })
      if (error) throw error
      setNewPermKey("")
      setNewPermName("")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar permissão")
    } finally {
      setLoading(false)
    }
  }

  const toggleLink = async (roleId: string, permId: string) => {
    setError(null)
    setLoading(true)
    try {
      const exists = links.some((l) => l.role_id === roleId && l.permission_id === permId)
      if (exists) {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permId)
        if (error) throw error
      } else {
        const { error } = await supabase.from("role_permissions").insert({ role_id: roleId, permission_id: permId })
        if (error) throw error
      }
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar role_permissions")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          RBAC (Admin)
        </h2>
        <p className="text-sm text-muted">
          Cadastro dinâmico de papéis e permissões. (A atribuição de roles para usuários podemos automatizar depois com AD.)
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-medium">Roles</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newRoleKey}
              onChange={(e) => setNewRoleKey(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="key (ex.: contratos)"
            />
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Nome (ex.: Contratos)"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={createRole}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            Criar role
          </button>
          <div className="space-y-2">
            {roles.map((r) => (
              <div key={r.id} className="rounded-md border border-border bg-background p-3">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted">{r.key}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-medium">Permissões</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newPermKey}
              onChange={(e) => setNewPermKey(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="key (ex.: process.manage)"
            />
            <input
              value={newPermName}
              onChange={(e) => setNewPermName(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Nome (ex.: Gerir Processos)"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={createPerm}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            Criar permissão
          </button>

          <div className="text-xs text-muted">Vincule permissões aos roles (role_permissions):</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted">
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 font-medium">Permissão</th>
                  {roles.slice(0, 4).map((r) => (
                    <th key={r.id} className="text-left py-2 pr-3 font-medium">
                      {r.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{p.key}</div>
                      <div className="text-muted">{p.name}</div>
                    </td>
                    {roles.slice(0, 4).map((r) => {
                      const checked = links.some((l) => l.role_id === r.id && l.permission_id === p.id)
                      return (
                        <td key={r.id} className="py-2 pr-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={loading}
                            onChange={() => toggleLink(r.id, p.id)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {roles.length > 4 ? (
              <div className="text-xs text-muted mt-2">
                Mostrando apenas os 4 primeiros roles na matriz (para não ficar enorme). Ajusto depois se quiser.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}

