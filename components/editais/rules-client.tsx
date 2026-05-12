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

function diffJson(a: any, b: any, path: string[] = [], out: Array<{ path: string; a: any; b: any }> = []) {
  const pa = path.join(".") || "(root)"
  if (a === b) return out
  const isObj = (x: any) => x && typeof x === "object"
  if (!isObj(a) || !isObj(b)) {
    out.push({ path: pa, a, b })
    return out
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      out.push({ path: pa, a, b })
      return out
    }
    for (let i = 0; i < a.length; i++) diffJson(a[i], b[i], [...path, String(i)], out)
    return out
  }
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) diffJson(a[k], b[k], [...path, k], out)
  return out
}

export function EditaisRulesClient({
  initialRuleSets,
  initialVersions,
  initialBatches,
}: {
  initialRuleSets: RuleSet[]
  initialVersions: RuleSetVersion[]
  initialBatches: Batch[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [ruleSets, setRuleSets] = useState<RuleSet[]>(initialRuleSets)
  const [versions, setVersions] = useState<RuleSetVersion[]>(initialVersions)
  const [batches] = useState<Batch[]>(initialBatches)

  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string | null>(ruleSets[0]?.id ?? null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const selectedRuleSet = ruleSets.find((r) => r.id === selectedRuleSetId) ?? null

  const versionsForSet = versions
    .filter((v) => v.rule_set_id === selectedRuleSetId)
    .sort((a, b) => b.version - a.version)

  const selectedVersion = versionsForSet.find((v) => v.id === selectedVersionId) ?? versionsForSet[0] ?? null

  const [newKey, setNewKey] = useState("")
  const [newName, setNewName] = useState("")
  const [jsonText, setJsonText] = useState<string>(() =>
    selectedVersion ? JSON.stringify(selectedVersion.tree, null, 2) : JSON.stringify({ rules: [] }, null, 2)
  )
  const [mode, setMode] = useState<"didatico" | "json">("didatico")
  const [rulesUi, setRulesUi] = useState<RuleRowUI[]>(() =>
    normalizeRulesFromTreeJson(selectedVersion?.tree ?? { rules: [] })
  )

  const [batchId, setBatchId] = useState<string>(batches[0]?.id ?? "")
  const [dryRunResult, setDryRunResult] = useState<any>(null)
  const [compareWithId, setCompareWithId] = useState<string>("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = async () => {
    const [rs, vs] = await Promise.all([
      supabase.from("edital_rule_sets").select("id,key,name,description,created_at").order("created_at", { ascending: false }),
      supabase
        .from("edital_rule_set_versions")
        .select("id,rule_set_id,version,status,tree,created_at")
        .order("created_at", { ascending: false }),
    ])
    if (rs.error) throw rs.error
    if (vs.error) throw vs.error
    setRuleSets((rs.data ?? []) as any)
    setVersions((vs.data ?? []) as any)
  }

  // quando troca version/ruleset
  const loadFromSelectedVersion = (v: RuleSetVersion | null) => {
    const tree = v?.tree ?? { rules: [] }
    setJsonText(JSON.stringify(tree, null, 2))
    setRulesUi(normalizeRulesFromTreeJson(tree))
  }

  const createRuleSet = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (!newKey.trim() || !newName.trim()) throw new Error("Preencha key e nome.")
      const { error } = await supabase.from("edital_rule_sets").insert({
        key: newKey.trim(),
        name: newName.trim(),
        description: null,
      })
      if (error) throw error
      setNewKey("")
      setNewName("")
      await reload()
      setMessage("Rule set criado.")
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar rule set")
    } finally {
      setLoading(false)
    }
  }

  const createVersion = async () => {
    if (!selectedRuleSetId) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const max = Math.max(0, ...versionsForSet.map((v) => v.version))
      const next = max + 1
      const tree = mode === "didatico" ? toTreeJsonFromRules(rulesUi) : JSON.parse(jsonText)
      const { error } = await supabase.from("edital_rule_set_versions").insert({
        rule_set_id: selectedRuleSetId,
        version: next,
        status: "draft",
        tree,
      })
      if (error) throw error
      await reload()
      setMessage(`Versão ${next} criada (draft).`)
    } catch (e: any) {
      setError(e?.message ?? "JSON inválido ou falha ao criar versão")
    } finally {
      setLoading(false)
    }
  }

  const publishSelected = async () => {
    if (!selectedVersion) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      // arquiva os demais
      const { error: aErr } = await supabase
        .from("edital_rule_set_versions")
        .update({ status: "archived" })
        .eq("rule_set_id", selectedVersion.rule_set_id)
        .neq("id", selectedVersion.id)
      if (aErr) throw aErr

      const { error: pErr } = await supabase.from("edital_rule_set_versions").update({ status: "published" }).eq("id", selectedVersion.id)
      if (pErr) throw pErr

      await reload()
      setMessage(`Versão ${selectedVersion.version} publicada.`)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao publicar versão")
    } finally {
      setLoading(false)
    }
  }

  const dryRun = async () => {
    if (!selectedVersion || !batchId) return
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch(
        `/api/editais/rules/dry-run?batch=${encodeURIComponent(batchId)}&versionId=${encodeURIComponent(selectedVersion.id)}`
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
          <p className="text-sm text-muted">Versões em JSON (E/OU) com publish + dry-run em lote.</p>
        </div>
        <Link href="/editais" className="text-xs underline text-muted">
          ← Voltar para Editais
        </Link>
      </div>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
      {message ? <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Rule sets</div>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
              onClick={() => reload().catch((e) => setError(e.message))}
            >
              Atualizar
            </button>
          </div>

          <div className="space-y-2">
            {ruleSets.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRuleSetId(r.id)
                  setSelectedVersionId(null)
                  const first = versions.filter((v) => v.rule_set_id === r.id).sort((a, b) => b.version - a.version)[0]
                  loadFromSelectedVersion(first ?? null)
                }}
                className={
                  "w-full text-left rounded-md border border-border bg-background p-3 hover:border-foreground/20 " +
                  (selectedRuleSetId === r.id ? "ring-2 ring-[hsl(var(--accent))]" : "")
                }
              >
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted">{r.key}</div>
              </button>
            ))}
            {!ruleSets.length ? <div className="text-xs text-muted">Nenhum rule set ainda.</div> : null}
          </div>

          <div className="pt-3 border-t border-border space-y-2">
            <div className="text-xs text-muted">Criar rule set</div>
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="key (ex.: default)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={loading}
              onClick={createRuleSet}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              Criar
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 space-y-3 lg:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Versões</div>
              <div className="text-xs text-muted">{selectedRuleSet ? `${selectedRuleSet.name} (${selectedRuleSet.key})` : "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || !selectedRuleSetId}
                onClick={createVersion}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
              >
                Criar versão (draft)
              </button>
              <button
                type="button"
                disabled={loading || !selectedVersion}
                onClick={publishSelected}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
              >
                Publicar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {versionsForSet.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setSelectedVersionId(v.id)
                  loadFromSelectedVersion(v)
                }}
                className={
                  "rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20 " +
                  (selectedVersion?.id === v.id ? "ring-2 ring-[hsl(var(--accent))]" : "")
                }
              >
                v{v.version} • {v.status}
              </button>
            ))}
            {!versionsForSet.length ? <div className="text-xs text-muted">Sem versões ainda.</div> : null}
          </div>

          <div className="rounded-md border border-border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Construtor de regras</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("didatico")}
                  className={
                    "rounded-md border border-border px-3 py-1.5 text-xs " +
                    (mode === "didatico" ? "bg-background" : "bg-surface hover:border-foreground/20")
                  }
                >
                  Didático
                </button>
                <button
                  type="button"
                  onClick={() => setMode("json")}
                  className={
                    "rounded-md border border-border px-3 py-1.5 text-xs " +
                    (mode === "json" ? "bg-background" : "bg-surface hover:border-foreground/20")
                  }
                >
                  JSON
                </button>
              </div>
            </div>

            {mode === "didatico" ? (
              <RuleBuilder value={rulesUi} onChange={(v) => setRulesUi(v)} />
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted">JSON da regra</div>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs min-h-[360px]"
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

            <div className="text-xs text-muted">
              Dica: o worker usa a última versão <b>published</b> do rule set <code>default</code>.
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <div className="text-sm font-medium">Diff entre versões</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={compareWithId}
                onChange={(e) => setCompareWithId(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="">Comparar com…</option>
                {versionsForSet
                  .filter((v) => v.id !== selectedVersion?.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} • {v.status}
                    </option>
                  ))}
              </select>
              <div className="text-xs text-muted flex items-center">
                Mostra mudanças (paths) entre a versão selecionada e outra.
              </div>
            </div>

            {compareWithId && selectedVersion ? (
              <pre className="text-xs whitespace-pre-wrap text-muted">
                {JSON.stringify(
                  diffJson(
                    versionsForSet.find((v) => v.id === compareWithId)?.tree ?? {},
                    selectedVersion.tree ?? {}
                  )
                    .slice(0, 80)
                    .map((d) => ({ path: d.path, from: d.a, to: d.b })),
                  null,
                  2
                )}
              </pre>
            ) : (
              <div className="text-xs text-muted">Selecione uma versão para comparar.</div>
            )}
          </div>

          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <div className="text-sm font-medium">Dry-run (simulação)</div>
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
                disabled={loading || !selectedVersion || !batchId}
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
                    const res = await fetch(`/api/editais/reprocess?batch=${encodeURIComponent(batchId)}&stage=evaluate`, {
                      method: "POST",
                    })
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
    </div>
  )
}
