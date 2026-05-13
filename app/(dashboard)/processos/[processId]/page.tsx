import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export default async function ProcessoDetalhesPage({ params }: { params: { processId: string } }) {
  const supabase = createClient()
  const processId = params.processId

  const { data: proc } = await supabase.from("processes").select("*").eq("id", processId).maybeSingle()
  if (!proc) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        Processo não encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/processos" className="text-xs underline text-muted">
          ← Voltar para processos
        </Link>
        <Link
          href={`/processos/gerenciar?processId=${processId}`}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black"
        >
          Gerenciar
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
        <div className="text-xl font-semibold">{proc.name}</div>
        <div className="text-xs text-muted">{proc.code ?? "—"}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Info label="O que" value={proc.what ?? "—"} />
        <Info label="Por quê" value={proc.why ?? "—"} />
        <Info label="Onde" value={proc.where_ ?? "—"} />
        <Info label="Quem" value={proc.who ?? "—"} />
        <Info label="Quando" value={proc.when_ ?? "—"} />
        <Info label="Como" value={proc.how ?? "—"} />
      </div>

      {proc.macro_summary || proc.micro_description ? (
        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">Detalhes</summary>
          <div className="mt-3 space-y-3">
            {proc.macro_summary ? <Block title="Macro" value={proc.macro_summary} /> : null}
            {proc.micro_description ? <Block title="Micro" value={proc.micro_description} /> : null}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  )
}

function Block({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-sm text-muted mt-1 whitespace-pre-wrap">{value}</div>
    </div>
  )
}

