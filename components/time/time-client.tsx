"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { TagInput } from "@/components/time/tag-input"

type TeamCertificate = {
  id: string
  member_id: string
  title: string
  issuer: string | null
  issued_at: string | null
  file_path: string
  file_url: string
  created_at: string
}

type TeamMember = {
  id: string
  name: string
  email: string
  role: string | null
  area: string | null
  phone: string | null
  linkedin_url: string | null
  bio: string | null
  skills: string[]
  avatar_url: string | null
  active: boolean
  created_at: string
  updated_at: string
  certificates?: TeamCertificate[]
}

function normalizeSkills(skills: unknown): string[] {
  if (!skills) return []
  if (Array.isArray(skills)) return skills.map(String).filter(Boolean)
  return []
}

export function TimeClient({
  initialMembers,
}: {
  initialMembers: TeamMember[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [skillFilter, setSkillFilter] = useState<string | null>(null)

  const [selected, setSelected] = useState<TeamMember | null>(null)

  const skillsUniverse = useMemo(() => {
    const s = new Set<string>()
    for (const m of members) for (const t of m.skills ?? []) s.add(t)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [members])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return members.filter((m) => {
      const matchesTerm =
        !term ||
        m.name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        (m.role ?? "").toLowerCase().includes(term) ||
        (m.area ?? "").toLowerCase().includes(term) ||
        (m.skills ?? []).some((t) => t.toLowerCase().includes(term))

      const matchesSkill = !skillFilter || (m.skills ?? []).includes(skillFilter)
      return matchesTerm && matchesSkill
    })
  }, [members, q, skillFilter])

  const reload = async () => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*, certificates:team_member_certificates(*)")
        .order("created_at", { ascending: false })

      if (error) throw error
      const normalized = (data ?? []).map((m: any) => ({
        ...m,
        skills: normalizeSkills(m.skills),
      }))
      setMembers(normalized)
      // atualiza seleção com versão mais recente
      if (selected) {
        const found = normalized.find((x: TeamMember) => x.id === selected.id) ?? null
        setSelected(found)
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar Time")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // garante que a lista reflita banco (caso SSR cache)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createMember = async (payload: Partial<TeamMember>) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("team_members").insert({
        name: payload.name,
        email: payload.email,
        role: payload.role ?? null,
        area: payload.area ?? null,
        phone: payload.phone ?? null,
        linkedin_url: payload.linkedin_url ?? null,
        bio: payload.bio ?? null,
        skills: payload.skills ?? [],
        active: payload.active ?? true,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar membro")
    } finally {
      setLoading(false)
    }
  }

  const updateMember = async (id: string, patch: Partial<TeamMember>) => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase
        .from("team_members")
        .update({
          ...patch,
          skills: patch.skills ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar membro")
    } finally {
      setLoading(false)
    }
  }

  const uploadAvatar = async (memberId: string, file: File) => {
    setError(null)
    setLoading(true)
    try {
      const path = `team/${memberId}/avatar-${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
      })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("avatars").getPublicUrl(path)
      await updateMember(memberId, { avatar_url: data.publicUrl })
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar avatar")
    } finally {
      setLoading(false)
    }
  }

  const uploadCertificate = async (
    memberId: string,
    file: File,
    meta: { title?: string; issuer?: string; issued_at?: string }
  ) => {
    setError(null)
    setLoading(true)
    try {
      const path = `team/${memberId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from("certificates").upload(path, file, {
        upsert: false,
      })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("certificates").getPublicUrl(path)

      const { error } = await supabase.from("team_member_certificates").insert({
        member_id: memberId,
        title: meta.title?.trim() || file.name,
        issuer: meta.issuer?.trim() || null,
        issued_at: meta.issued_at || null,
        file_path: path,
        file_url: data.publicUrl,
      })
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar certificado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Time
          </h1>
          <p className="text-sm text-muted">
            MVP+ com skills (tags), avatar e certificados (preparado para evoluir para RBAC).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
          >
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: filters + list */}
        <section className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, email, cargo, área ou skill…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={skillFilter ?? ""}
                onChange={(e) => setSkillFilter(e.target.value || null)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm md:w-60"
              >
                <option value="">Todas as skills</option>
                {skillsUniverse.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted">
              {loading ? "Carregando…" : `${filtered.length} membro(s)`}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m)}
                className="text-left rounded-lg border border-border bg-surface p-4 hover:border-foreground/20"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-background border border-border overflow-hidden shrink-0">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted truncate">{m.email}</div>
                    <div className="text-xs text-muted truncate">
                      {(m.role ?? "—") + (m.area ? ` • ${m.area}` : "")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(m.skills ?? []).slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted"
                        >
                          {t}
                        </span>
                      ))}
                      {(m.skills ?? []).length > 6 ? (
                        <span className="text-[11px] text-muted">+{(m.skills ?? []).length - 6}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Right: create / details */}
        <aside className="space-y-4">
          <CreateMemberCard onCreate={createMember} loading={loading} />
          <MemberDetailsCard
            member={selected}
            onClose={() => setSelected(null)}
            onUpdate={updateMember}
            onUploadAvatar={uploadAvatar}
            onUploadCertificate={uploadCertificate}
            loading={loading}
          />
        </aside>
      </div>
    </div>
  )
}

function CreateMemberCard({
  onCreate,
  loading,
}: {
  onCreate: (payload: Partial<TeamMember>) => Promise<void>
  loading: boolean
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [area, setArea] = useState("")
  const [skills, setSkills] = useState<string[]>([])

  return (
    <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="text-sm font-medium">Adicionar membro</div>
      <label className="block space-y-1">
        <div className="text-xs text-muted">Nome</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="block space-y-1">
        <div className="text-xs text-muted">Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <div className="text-xs text-muted">Cargo</div>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <div className="text-xs text-muted">Área</div>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div>
        <div className="text-xs text-muted mb-1">Skills (tags)</div>
        <TagInput value={skills} onChange={setSkills} placeholder="Ex.: SQL, Power BI, Gestão…" />
      </div>
      <button
        type="button"
        disabled={loading || !name.trim() || !email.trim()}
        onClick={async () => {
          await onCreate({
            name: name.trim(),
            email: email.trim(),
            role: role.trim() || null,
            area: area.trim() || null,
            skills,
            active: true,
          })
          setName("")
          setEmail("")
          setRole("")
          setArea("")
          setSkills([])
        }}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Salvar"}
      </button>
    </section>
  )
}

function MemberDetailsCard({
  member,
  onClose,
  onUpdate,
  onUploadAvatar,
  onUploadCertificate,
  loading,
}: {
  member: TeamMember | null
  onClose: () => void
  onUpdate: (id: string, patch: Partial<TeamMember>) => Promise<void>
  onUploadAvatar: (id: string, file: File) => Promise<void>
  onUploadCertificate: (
    id: string,
    file: File,
    meta: { title?: string; issuer?: string; issued_at?: string }
  ) => Promise<void>
  loading: boolean
}) {
  const [draft, setDraft] = useState<TeamMember | null>(member)
  const [certTitle, setCertTitle] = useState("")
  const [certIssuer, setCertIssuer] = useState("")
  const [certIssuedAt, setCertIssuedAt] = useState("")

  useEffect(() => setDraft(member), [member])

  if (!member || !draft) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="text-sm text-muted">Selecione um membro para ver detalhes.</div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{member.name}</div>
          <div className="text-xs text-muted truncate">{member.email}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-foreground/20"
        >
          Fechar
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted">Avatar</div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-background border border-border overflow-hidden">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <input
            type="file"
            accept="image/*"
            disabled={loading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              await onUploadAvatar(member.id, file)
              e.target.value = ""
            }}
            className="text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <div className="text-xs text-muted">Cargo</div>
          <input
            value={draft.role ?? ""}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <div className="text-xs text-muted">Área</div>
          <input
            value={draft.area ?? ""}
            onChange={(e) => setDraft({ ...draft, area: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <div className="text-xs text-muted">Telefone</div>
          <input
            value={draft.phone ?? ""}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <div className="text-xs text-muted">LinkedIn (URL)</div>
          <input
            value={draft.linkedin_url ?? ""}
            onChange={(e) => setDraft({ ...draft, linkedin_url: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <div className="text-xs text-muted">Bio</div>
        <textarea
          value={draft.bio ?? ""}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-20"
        />
      </label>

      <div>
        <div className="text-xs text-muted mb-1">Skills (tags)</div>
        <TagInput value={draft.skills ?? []} onChange={(skills) => setDraft({ ...draft, skills })} />
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          await onUpdate(member.id, {
            role: (draft.role ?? "").trim() || null,
            area: (draft.area ?? "").trim() || null,
            phone: (draft.phone ?? "").trim() || null,
            linkedin_url: (draft.linkedin_url ?? "").trim() || null,
            bio: (draft.bio ?? "").trim() || null,
            skills: draft.skills ?? [],
          })
        }}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Salvar alterações"}
      </button>

      <div className="pt-3 border-t border-border space-y-3">
        <div className="text-sm font-medium">Certificados</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1 col-span-2">
            <div className="text-xs text-muted">Título</div>
            <input
              value={certTitle}
              onChange={(e) => setCertTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="ex.: Certificação XYZ"
            />
          </label>
          <label className="block space-y-1">
            <div className="text-xs text-muted">Emissor</div>
            <input
              value={certIssuer}
              onChange={(e) => setCertIssuer(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="ex.: AWS"
            />
          </label>
          <label className="block space-y-1">
            <div className="text-xs text-muted">Data</div>
            <input
              value={certIssuedAt}
              onChange={(e) => setCertIssuedAt(e.target.value)}
              type="date"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <input
          type="file"
          disabled={loading}
          accept="application/pdf,image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            await onUploadCertificate(member.id, file, {
              title: certTitle,
              issuer: certIssuer,
              issued_at: certIssuedAt || undefined,
            })
            setCertTitle("")
            setCertIssuer("")
            setCertIssuedAt("")
            e.target.value = ""
          }}
          className="text-xs"
        />

        <div className="space-y-2">
          {(member.certificates ?? []).length ? (
            <div className="space-y-2">
              {(member.certificates ?? [])
                .slice()
                .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                .map((c) => (
                  <div key={c.id} className="rounded-md border border-border bg-background p-2">
                    <div className="text-xs font-medium">{c.title}</div>
                    <div className="text-[11px] text-muted">
                      {(c.issuer ?? "—") + (c.issued_at ? ` • ${c.issued_at}` : "")}
                    </div>
                    <a className="text-[11px] underline text-muted" href={c.file_url} target="_blank">
                      Abrir arquivo
                    </a>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-xs text-muted">Nenhum certificado anexado ainda.</div>
          )}
        </div>
      </div>
    </section>
  )
}

