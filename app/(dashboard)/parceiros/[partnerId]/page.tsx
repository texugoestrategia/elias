import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export default async function ParceiroDetalhesPage({ params }: { params: { partnerId: string } }) {
  const supabase = createClient()
  const partnerId = params.partnerId

  const [{ data: partner }, { data: focals }, { data: materials }, { count: catalogCount }] = await Promise.all([
    supabase.from("partners").select("*").eq("id", partnerId).maybeSingle(),
    supabase.from("partner_focal_points").select("*").eq("partner_id", partnerId).order("is_primary", { ascending: false }),
    supabase
      .from("partner_marketing_materials")
      .select("id,title,type,public_url,created_at")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("partner_catalog_items").select("*", { count: "exact", head: true }).eq("partner_id", partnerId),
  ])

  if (!partner) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        Parceiro não encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/parceiros" className="text-xs underline text-muted">
          ← Voltar para parceiros
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/parceiros/certificacoes" className="text-xs underline text-muted">
            Certificações
          </Link>
          <Link
            href={`/parceiros/gerenciar?partnerId=${partnerId}`}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black"
          >
            Gerenciar
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-14 w-14 rounded-lg border border-border bg-background overflow-hidden shrink-0 flex items-center justify-center">
              {partner.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={partner.logo_url} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted">{String(partner.name).slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold truncate">{partner.name}</div>
              <div className="text-xs text-muted truncate">
                {(partner.segment ?? "—") + (partner.website ? ` • ${partner.website}` : "")}
              </div>
              <div className="text-xs text-muted truncate">
                {(partner.legal_name ?? "—") + (partner.cnpj ? ` • ${partner.cnpj}` : "")}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-muted">Prioridade</div>
            <div className="text-2xl font-semibold">{partner.priority ?? 0}</div>
          </div>
        </div>

        {partner.notes ? <div className="mt-3 text-sm text-muted whitespace-pre-wrap">{partner.notes}</div> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Pontos focais</div>
            <div className="text-xs text-muted">{focals?.length ?? 0}</div>
          </div>
          <div className="space-y-2">
            {(focals ?? []).map((f: any) => (
              <div key={f.id} className="rounded-md border border-border bg-background p-3">
                <div className="text-sm font-medium">
                  {f.name}{" "}
                  {f.is_primary ? (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">Principal</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted">{(f.email ?? "—") + (f.phone ? ` • ${f.phone}` : "")}</div>
                <div className="text-xs text-muted">{f.department ?? "—"}</div>
              </div>
            ))}
            {!focals?.length ? <div className="text-xs text-muted">Nenhum ponto focal.</div> : null}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Materiais de divulgação</div>
            <div className="text-xs text-muted">{materials?.length ?? 0}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(materials ?? []).map((m: any) => (
              <a
                key={m.id}
                href={m.public_url ?? "#"}
                target="_blank"
                className="rounded-md border border-border bg-background p-3 hover:border-foreground/20"
              >
                <div className="text-sm font-medium truncate">{m.title}</div>
                <div className="text-xs text-muted">{m.type}</div>
              </a>
            ))}
            {!materials?.length ? <div className="text-xs text-muted">Nenhum material cadastrado.</div> : null}
          </div>

          <div className="text-xs text-muted pt-2 border-t border-border">
            Itens no catálogo (produtos/serviços): {catalogCount ?? 0}
          </div>
        </section>
      </div>
    </div>
  )
}
