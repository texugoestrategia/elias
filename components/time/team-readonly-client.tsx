"use client"

import { useMemo, useState } from "react"

type TeamCertificate = {
  id: string
  title: string
  issuer: string | null
  issued_at: string | null
  file_url: string
}

type TeamMember = {
  id: string
  name: string
  email: string
  role: string | null
  area: string | null
  avatar_url: string | null
  skills: string[]
  certificates?: TeamCertificate[]
}

export function TeamReadonlyClient({ initialMembers }: { initialMembers: TeamMember[] }) {
  const [q, setQ] = useState("")
  const [members] = useState<TeamMember[]>(initialMembers)
  const [selectedId, setSelectedId] = useState<string | null>(initialMembers[0]?.id ?? null)

  const selected = useMemo(() => members.find((m) => m.id === selectedId) ?? null, [members, selectedId])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return members
    return members.filter((m) => (m.name + " " + m.email + " " + (m.role ?? "") + " " + (m.area ?? "")).toLowerCase().includes(term))
  }, [members, q])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Time
          </h1>
          <p className="text-sm text-muted">Consulta do time (somente leitura). Para editar, use “Gerenciar”.</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome/email/cargo/área…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="text-xs text-muted">{filtered.length} membro(s)</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-1 rounded-lg border border-border bg-surface p-3 space-y-2">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={
                "w-full text-left rounded-md border border-border bg-background p-3 hover:border-foreground/20 " +
                (m.id === selectedId ? "ring-2 ring-[hsl(var(--accent))]" : "")
              }
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full border border-border bg-surface overflow-hidden shrink-0">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-xs text-muted truncate">{m.email}</div>
                  <div className="text-xs text-muted truncate">
                    {(m.role ?? "—") + (m.area ? ` • ${m.area}` : "")}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {!filtered.length ? <div className="text-xs text-muted">Nenhum membro.</div> : null}
        </section>

        <section className="lg:col-span-2 rounded-lg border border-border bg-surface p-4 space-y-3">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{selected.name}</div>
                  <div className="text-xs text-muted">{selected.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Info label="Cargo" value={selected.role ?? "—"} />
                <Info label="Área" value={selected.area ?? "—"} />
              </div>

              <details className="rounded-md border border-border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium">Skills</summary>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(selected.skills ?? []).length ? (
                    (selected.skills ?? []).map((t) => (
                      <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        {t}
                      </span>
                    ))
                  ) : (
                    <div className="text-xs text-muted">—</div>
                  )}
                </div>
              </details>

              <details className="rounded-md border border-border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium">Certificados</summary>
                <div className="mt-2 space-y-2">
                  {(selected.certificates ?? []).map((c) => (
                    <a
                      key={c.id}
                      href={c.file_url}
                      target="_blank"
                      className="block rounded-md border border-border bg-surface p-3 hover:border-foreground/20"
                    >
                      <div className="text-sm font-medium">{c.title}</div>
                      <div className="text-xs text-muted">
                        {(c.issuer ?? "—") + (c.issued_at ? ` • ${c.issued_at}` : "")}
                      </div>
                    </a>
                  ))}
                  {!selected.certificates?.length ? <div className="text-xs text-muted">—</div> : null}
                </div>
              </details>
            </>
          ) : (
            <div className="text-sm text-muted">Selecione um membro.</div>
          )}
        </section>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}

