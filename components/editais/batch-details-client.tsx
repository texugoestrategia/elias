"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type JobRow = {
  job_id: string
  edital_id: string
  current_stage: string
  status: string
  attempts: number
  last_error: string | null
  file_name: string
  file_mime: string | null
  verdict: string | null
  score: number | null
  updated_at: string
}

export function EditalBatchDetailsClient({
  batchId,
  batchName,
  initialJobs,
}: {
  batchId: string
  batchName: string
  initialJobs: JobRow[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reprocessStage, setReprocessStage] = useState<"extract" | "classify" | "normalize" | "evaluate" | "conclude">("evaluate")

  const reload = async () => {
    const { data, error } = await supabase
      .from("editais")
      .select(
        "id,verdict,score, files:edital_files(original_filename,mime_type), job:edital_jobs(id,current_stage,status,attempts,last_error,updated_at)"
      )
      .eq("batch_id", batchId)
    if (error) throw error
    const mapped: JobRow[] = (data ?? [])
      .map((r: any) => ({
        job_id: r.job?.id ?? r.id,
        edital_id: r.id,
        current_stage: r.job?.current_stage ?? "extract",
        status: r.job?.status ?? "queued",
        attempts: r.job?.attempts ?? 0,
        last_error: r.job?.last_error ?? null,
        file_name: r.files?.original_filename ?? "—",
        file_mime: r.files?.mime_type ?? null,
        verdict: r.verdict ?? null,
        score: r.score ?? null,
        updated_at: r.job?.updated_at ?? new Date().toISOString(),
      }))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    setJobs(mapped)
  }

  const processBatch = async () => {
    setError(null)
    setMessage(null)
    setRunning(true)
    try {
      // executa "worker" em loop, 1 estágio por chamada
      for (let i = 0; i < 500; i++) {
        const res = await fetch(`/api/editais/worker?batch=${encodeURIComponent(batchId)}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error ?? "Falha no worker")
        if (json.done) break
      }
      setMessage("Processamento acionado. Atualize a lista para ver o progresso.")
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao processar")
    } finally {
      setRunning(false)
    }
  }

  const reprocessFromStage = async () => {
    setError(null)
    setMessage(null)
    setRunning(true)
    try {
      const res = await fetch(
        `/api/editais/reprocess?batch=${encodeURIComponent(batchId)}&stage=${encodeURIComponent(reprocessStage)}`,
        { method: "POST" }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Falha ao reprocessar")
      setMessage(`Reprocessamento agendado a partir de "${reprocessStage}" (reset: ${json.reset}). Rode “Processar agora”.`)
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao reprocessar")
    } finally {
      setRunning(false)
    }
  }

  const counts = useMemo(() => {
    const total = jobs.length
    const done = jobs.filter((j) => j.status === "done").length
    const err = jobs.filter((j) => j.status === "error").length
    const running = jobs.filter((j) => j.status === "running").length
    const queued = jobs.filter((j) => j.status === "queued" || j.status === "retry").length
    return { total, done, err, running, queued }
  }, [jobs])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {batchName}
        </h1>
        <p className="text-sm text-muted">
          Jobs por edital. Clique em “Processar agora” para rodar o pipeline (1 estágio por chamada, com retomada).
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div>
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Total" value={counts.total} />
        <Stat label="Fila" value={counts.queued} />
        <Stat label="Rodando" value={counts.running} />
        <Stat label="Concluídos" value={counts.done} />
        <Stat label="Erro" value={counts.err} />
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={running}
          onClick={processBatch}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
        >
          {running ? "Processando…" : "Processar agora"}
        </button>
        <button
          type="button"
          disabled={running}
          onClick={reprocessFromStage}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
          title="Reprocessa a partir do estágio escolhido (não re-extrai se você escolher evaluate)"
        >
          Reprocessar
        </button>
        <select
          value={reprocessStage}
          onChange={(e) => setReprocessStage(e.target.value as any)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          title="Escolha o estágio inicial do reprocessamento"
        >
          <option value="extract">Extract</option>
          <option value="classify">Classify</option>
          <option value="normalize">Normalize</option>
          <option value="evaluate">Evaluate</option>
          <option value="conclude">Conclude</option>
        </select>
        <button
          type="button"
          onClick={() => reload().catch((e) => setError(e.message))}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20"
        >
          Atualizar
        </button>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Editais do lote</div>
        <div className="space-y-2">
          {jobs.map((j) => (
            <div key={j.job_id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{j.file_name}</div>
                  <div className="text-xs text-muted">
                    {j.status} • estágio {j.current_stage} • tentativas {j.attempts}
                  </div>
                  {j.last_error ? <div className="text-xs text-danger mt-1">{j.last_error}</div> : null}
                </div>
                <div className="text-xs text-muted shrink-0 text-right">
                  <div>{j.verdict ?? "—"}</div>
                  <div>{j.score ?? "—"}</div>
                </div>
              </div>
            </div>
          ))}
          {!jobs.length ? <div className="text-xs text-muted">Nenhum job encontrado.</div> : null}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}
