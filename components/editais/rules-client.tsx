"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { RuleBuilder, normalizeRulesFromTreeJson, toTreeJsonFromRules, type RuleRowUI } from "@/components/editais/rule-builder"

type RuleSet = {
  id: string
  key: string
  name: string
  description: string | null
  created_at: string
}

type RuleSetVersion = {
  id: string
  rule_set_id: string
  version: number
  status: "draft" | "published" | "archived"
  tree: any
  created_at: string
}

type Batch = { id: string; name: string; created_at: string }

export function EditaisRulesClient({
  initialRuleSet,
  initialPublishedVersion,
  initialBatches,
}: {
  initialRuleSet: RuleSet | null
  initialPublishedVersion: RuleSetVersion | null
  initialBatches: Batch[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [batches] = useState<Batch[]>(initialBatches)

  const [ruleSet, setRuleSet] = useState<RuleSet | null>(initialRuleSet)
  const [publishedVersion, setPublishedVersion] = useState<RuleSetVersion | null>(initialPublishedVersion)

  // UX: por padrão, só modo didático (JSON fica escondido como opção avançada)
  const [mode, setMode] = useState<"didatico" | "json">("didatico")
  const [rulesUi, setRulesUi] = useState<RuleRowUI[]>(() => normalizeRulesFromTreeJson(publishedVersion?.tree ?? { rules: [] }))
  const [jsonText, setJsonText] = useState<string>(() => JSON.stringify(publishedVersion?.tree ?? { rules: [] }, null, 2))

  const [batchId, setBatchId] = useState<string>(batches[0]?.id ?? "")
  const [dryRunResult, setDryRunResult] = useState<any>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const ensureDefaultRuleSet = async (): Promise<RuleSet> => {
    if (ruleSet?.id) return ruleSet
    const { data, error } = await supabase
      .from("edital_rule_sets")
      .upsert({ key: "default", name: "Padrão", description: "Conjunto padrão de regras" }, { onConflict: "key" })
      .select("id,key,name,description,created_at")
      .single()
    if (error) throw error
    setRuleSet(data as any)
    return data as any
  }

  const savePublished = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const rs = await ensureDefaultRuleSet()
      const tree = mode === "didatico" ? toTreeJsonFromRules(rulesUi) : JSON.parse(jsonText)

      if (publishedVersion?.id) {
        const { error } = await supabase
          .from("edital_rule_set_versions")
          .update({ tree, status: "published" })
          .eq("id", publishedVersion.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from("edital_rule_set_versions")
          .insert({ rule_set_id: rs.id, version: 1, status: "published", tree })
          .select("id,rule_set_id,version,status,tree,created_at")
          .single()
        if (error) throw error
        setPublishedVersion(data as any)
      }

      // Mantém só a última: remove qualquer outra versão do rule_set
      if (publishedVersion?.id) {
        await supabase.from("edital_rule_set_versions").delete().eq("rule_set_id", rs.id).neq("id", publishedVersion.id)
      }

      setMessage("Regras salvas.")
    } catch (e: any) {
      setError(e?.message ?? "Falha ao salvar regras")
    } finally {
      setLoading(false)
    }
  }

  const dryRun = async () => {
    if (!publishedVersion || !batchId) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch(
        `/api/editais/rules/dry-run?batch=${encodeURIComponent(batchId)}&versionId=${encodeURIComponent(publishedVersion.id)}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Falha no dry-run")
      setDryRunResult(json)
      setMessage("Dry-run concluído.")
    } catch (e: any) {
      setError(e?.message ?? "Falha no dry-run")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Regras de Editais
          </h1>
          <p className="text-sm text-muted">Construtor simples (para o time comercial) + simulação (dry-run).</p>
        </div>
        <Link href="/editais" className="text-xs underline text-muted">
          ← Voltar para Editais
        </Link>
      </div>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      {message ? <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div> : null}

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <div className="text-sm font-medium">Regras</div>
            <div className="text-xs text-muted">Conjunto padrão (default). Não mostramos versões para simplificar.</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={savePublished}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              Salvar regras
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "didatico" ? "json" : "didatico"))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20"
              title="Modo avançado"
            >
              {mode === "didatico" ? "Avançado" : "Voltar"}
            </button>
          </div>
        </div>

        {mode === "didatico" ? (
          <RuleBuilder value={rulesUi} onChange={(v) => setRulesUi(v)} />
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted">JSON (modo avançado)</div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs min-h-[420px]"
            />
            <button
              type="button"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-foreground/20"
              onClick={() => {
                try {
                  const parsed = JSON.parse(jsonText)
                  setRulesUi(normalizeRulesFromTreeJson(parsed))
                  setMessage("JSON carregado no modo didático.")
                  setMode("didatico")
                } catch (e: any) {
                  setError(e?.message ?? "JSON inválido")
                }
              }}
            >
              Carregar JSON no modo didático
            </button>
          </div>
        )}

        <div className="rounded-md border border-border bg-background p-3 space-y-2">
          <div className="text-sm font-medium">Simulação (dry-run)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={loading || !publishedVersion || !batchId}
              onClick={dryRun}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
            >
              Rodar dry-run
            </button>
            <button
              type="button"
              disabled={loading || !batchId}
              onClick={async () => {
                setError(null)
                setMessage(null)
                setLoading(true)
                try {
                  const res = await fetch(`/api/editais/reprocess?batch=${encodeURIComponent(batchId)}&stage=evaluate`, { method: "POST" })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json?.error ?? "Falha ao reprocessar")
                  setMessage(`Lote resetado (reset: ${json.reset}). Agora rode “Processar agora” no lote.`)
                } catch (e: any) {
                  setError(e?.message ?? "Falha ao reprocessar")
                } finally {
                  setLoading(false)
                }
              }}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
              title="Reprocessa do estágio Evaluate em diante (sem re-extrair PDF)"
            >
              Reprocessar lote
            </button>
          </div>

          {dryRunResult ? (
            <pre className="text-xs whitespace-pre-wrap text-muted">{JSON.stringify(dryRunResult, null, 2)}</pre>
          ) : (
            <div className="text-xs text-muted">Rode para ver quantos editais mudariam (APTO/INAPTO/etc).</div>
          )}
        </div>
      </section>
    </div>
  )
}
