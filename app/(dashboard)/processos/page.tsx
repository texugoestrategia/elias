import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export default async function ProcessosPage() {
  const supabase = createClient()

  const { data: processes } = await supabase
    .from("processes")
    .select("id,name,code,active")
    .order("name", { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Processos
          </h1>
          <p className="text-sm text-muted">Lista simples. Clique para ver detalhes. Edição fica em “Gerenciar”.</p>
        </div>
        <Link href="/processos/gerenciar" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black">
          Gerenciar
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {(processes ?? []).map((p: any) => (
          <Link key={p.id} href={`/processos/${p.id}`} className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
            <div className="text-sm font-medium">{p.name}</div>
            <div className="text-xs text-muted">{p.code ?? "—"}</div>
          </Link>
        ))}
        {!processes?.length ? <div className="text-xs text-muted">Nenhum processo.</div> : null}
      </div>
    </div>
  )
}
