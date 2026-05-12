"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type UnknownTerm = {
  id: string
  batch_id: string
  edital_id: string
  term: string
  context: string | null
  status: "open" | "resolved" | "ignored"
  resolved_to_key: string | null
  created_at: string
}

type Dict = {
  id: string
  pattern: string
  internal_key: string
  kind: "regex" | "contains"
  created_at: string
}

export function EditaisTermosClient({
  initialTerms,
  initialDictionary,
}: {
  initialTerms: UnknownTerm[]
  initialDictionary: Dict[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [terms, setTerms] = useState<UnknownTerm[]>(initialTerms)
  const [dict, setDict] = useState<Dict[]>(initialDictionary)

  const [internalKey, setInternalKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = async () => {
    const [t, d] = await Promise.all([
      supabase
        .from("edital_unknown_terms")
        .select("id,batch_id,edital_id,term,context,status,resolved_to_key,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("edital_term_dictionary").select("id,pattern,internal_key,kind,created_at").order("created_at", { ascending: false }),
    ])
    if (t.error) throw t.error
    if (d.error) throw d.error
    setTerms((t.data ?? []) as any)
    setDict((d.data ?? []) as any)
  }

  const resolve = async (termId: string, term: string) => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (!internalKey.trim()) throw new Error("Informe o internal_key para mapear.")

      // adiciona no dicionário (contains) e marca como resolved
      const { error: dErr } = await supabase.from("edital_term_dictionary").insert({
        pattern: term,
        internal_key: internalKey.trim(),
        kind: "contains",
      })
      if (dErr && !dErr.message?.includes("duplicate")) throw dErr

      const { error: uErr } = await supabase
        .from("edital_unknown_terms")
        .update({ status: "resolved", resolved_to_key: internalKey.trim() })
        .eq("id", termId)
      if (uErr) throw uErr

      setMessage("Termo mapeado e resolvido.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao resolver termo")
    } finally {
      setLoading(false)
    }
  }

  const ignore = async (termId: string) => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const { error } = await supabase.from("edital_unknown_terms").update({ status: "ignored" }).eq("id", termId)
      if (error) throw error
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao ignorar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Termos desconhecidos
          </h1>
          <p className="text-sm text-muted">Fila para alimentar o dicionário de normalização.</p>
        </div>
        <Link href="/editais" className="text-xs underline text-muted">
          ← Voltar para Editais
        </Link>
      </div>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      {message ? <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div> : null}

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Mapear para internal_key</div>
        <input
          value={internalKey}
          onChange={(e) => setInternalKey(e.target.value)}
          placeholder="Ex.: certificacao.iso_27001"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="text-xs text-muted">Esse internal_key vira a “capability” consultável pelo motor de regras.</div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Fila</div>
          <button
            type="button"
            onClick={() => reload().catch((e) => setError(e.message))}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
          >
            Atualizar
          </button>
        </div>

        <div className="space-y-2">
          {terms.map((t) => (
            <div key={t.id} className="rounded-md border border-border bg-background p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.term}</div>
                  <div className="text-xs text-muted">
                    {t.status} • {new Date(t.created_at).toLocaleString()}
                  </div>
                  {t.context ? <div className="text-xs text-muted mt-1">{t.context}</div> : null}
                  {t.resolved_to_key ? <div className="text-xs text-muted mt-1">→ {t.resolved_to_key}</div> : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={loading || t.status !== "open"}
                    onClick={() => resolve(t.id, t.term)}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-60"
                  >
                    Resolver
                  </button>
                  <button
                    type="button"
                    disabled={loading || t.status !== "open"}
                    onClick={() => ignore(t.id)}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-foreground/20 disabled:opacity-60"
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!terms.length ? <div className="text-xs text-muted">Nenhum termo na fila.</div> : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Dicionário atual</div>
        <div className="space-y-2">
          {dict.slice(0, 20).map((d) => (
            <div key={d.id} className="rounded-md border border-border bg-background p-3">
              <div className="text-sm font-medium">{d.internal_key}</div>
              <div className="text-xs text-muted">
                {d.kind} • {d.pattern}
              </div>
            </div>
          ))}
          {!dict.length ? <div className="text-xs text-muted">Nenhum termo mapeado ainda.</div> : null}
        </div>
      </section>
    </div>
  )
}

