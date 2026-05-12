import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { EditalBatchDetailsClient } from "@/components/editais/batch-details-client"

export default async function EditalBatchPage({ params }: { params: { batchId: string } }) {
  const supabase = createClient()
  const batchId = params.batchId

  const { data: batch } = await supabase
    .from("edital_batches")
    .select("id,name")
    .eq("id", batchId)
    .maybeSingle()

  const { data: rows } = await supabase
    .from("editais")
    .select(
      "id,verdict,score, files:edital_files(original_filename,mime_type), job:edital_jobs(id,current_stage,status,attempts,last_error,updated_at)"
    )
    .eq("batch_id", batchId)

  const mapped = (rows ?? [])
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
      updated_at: r.job?.updated_at ?? r.updated_at ?? new Date().toISOString(),
    }))
    .sort((a: any, b: any) => (a.updated_at < b.updated_at ? 1 : -1))

  return (
    <div className="space-y-4">
      <Link href="/editais" className="text-xs underline text-muted">
        ← Voltar para lotes
      </Link>
      <EditalBatchDetailsClient batchId={batchId} batchName={batch?.name ?? "Lote"} initialJobs={mapped} />
    </div>
  )
}
