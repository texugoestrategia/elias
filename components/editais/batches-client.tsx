"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Batch = {
  id: string
  name: string
  status: string
  total_files: number
  processed_files: number
  error_files: number
  created_at: string
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function EditaisBatchesClient({ initialBatches }: { initialBatches: Batch[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [batches, setBatches] = useState<Batch[]>(initialBatches)
  const [name, setName] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = async () => {
    const { data } = await supabase
      .from("edital_batches")
      .select("id,name,status,total_files,processed_files,error_files,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
    setBatches((data ?? []) as any)
  }

  const createBatch = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      if (!name.trim()) throw new Error("Digite um nome para o lote.")
      if (!files.length) throw new Error("Selecione ao menos 1 arquivo.")

      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!authData.user) throw new Error("Não autenticado")

      const { data: batch, error: bErr } = await supabase
        .from("edital_batches")
        .insert({ name: name.trim(), created_by: authData.user.id, status: "queued" })
        .select("id,name,status,total_files,processed_files,error_files,created_at")
        .single()
      if (bErr) throw bErr

      let ok = 0
      let skipped = 0

      for (const f of files) {
        const hash = await sha256Hex(f)
        const storagePath = `batches/${batch.id}/${hash}-${f.name}`

        // idempotência por hash dentro do lote
        const { data: existing } = await supabase
          .from("edital_files")
          .select("id")
          .eq("batch_id", batch.id)
          .eq("sha256", hash)
          .maybeSingle()

        if (existing?.id) {
          skipped += 1
          continue
        }

        const { error: upErr } = await supabase.storage.from("editais").upload(storagePath, f, { upsert: false })
        if (upErr) throw upErr

        const { data: fileRow, error: fErr } = await supabase
          .from("edital_files")
          .insert({
            batch_id: batch.id,
            sha256: hash,
            original_filename: f.name,
            mime_type: f.type || null,
            size_bytes: f.size,
            storage_path: storagePath,
          })
          .select("id")
          .single()
        if (fErr) throw fErr

        const { data: editalRow, error: eErr } = await supabase
          .from("editais")
          .insert({
            batch_id: batch.id,
            file_id: fileRow.id,
            status: "queued",
            urgency_score: 0,
          })
          .select("id")
          .single()
        if (eErr) throw eErr

        const { error: jErr } = await supabase.from("edital_jobs").insert({
          edital_id: editalRow.id,
          current_stage: "extract",
          status: "queued",
        })
        if (jErr) throw jErr

        ok += 1
      }

      await supabase
        .from("edital_batches")
        .update({ total_files: ok + skipped, updated_at: new Date().toISOString() })
        .eq("id", batch.id)

      setMessage(`Lote criado com ${ok} arquivo(s).${skipped ? ` ${skipped} duplicado(s) ignorado(s).` : ""}`)
      setName("")
      setFiles([])
      await reload()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar lote")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Editais
        </h1>
        <p className="text-sm text-muted">
          Suba um lote e acompanhe o pipeline (estágios reexecutáveis) com falha parcial e retomada.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div>
      ) : null}

      <details className="rounded-lg border border-border bg-surface p-4" open={false}>
        <summary className="cursor-pointer text-sm font-medium">Novo lote</summary>
        <div className="mt-3 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder='Ex.: "Editais Outubro 2026"'
          />
          <input
            type="file"
            multiple
            accept="application/pdf,image/*,.xml,.bpmn,.xlsx"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-xs"
          />
          <div className="text-xs text-muted">{files.length ? `${files.length} arquivo(s) selecionado(s)` : "—"}</div>
          <button
            type="button"
            disabled={loading}
            onClick={createBatch}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            {loading ? "Criando…" : "Criar lote e enfileirar"}
          </button>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <Link className="text-xs underline text-muted" href="/editais/regras">
          Regras (JSON + dry-run)
        </Link>
        <Link className="text-xs underline text-muted" href="/editais/termos">
          Termos desconhecidos
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Lotes</div>
          <button
            type="button"
            onClick={reload}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
          >
            Atualizar
          </button>
        </div>

        <div className="space-y-2">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/editais/${b.id}`}
              className="block rounded-md border border-border bg-background p-3 hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{b.name}</div>
                  <div className="text-xs text-muted">
                    {new Date(b.created_at).toLocaleString()} • {b.status}
                  </div>
                </div>
                <div className="text-xs text-muted shrink-0">
                  {b.processed_files}/{b.total_files} • erro {b.error_files}
                </div>
              </div>
            </Link>
          ))}
          {!batches.length ? <div className="text-xs text-muted">Nenhum lote ainda.</div> : null}
        </div>
      </section>
    </div>
  )
}
