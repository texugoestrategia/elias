import Link from "next/link"
import { AlertBanner } from "@/components/layout/alert-banner"
import { createClient } from "@/lib/supabase/server"

const defaultShortcuts = [
  { href: "/parceiros", label: "Parceiros" },
  { href: "/time", label: "Time" },
  { href: "/processos", label: "Processos" },
  { href: "/editais", label: "Editais" },
]

function applyLayout(items: typeof defaultShortcuts, layout: any | null) {
  const order: string[] = Array.isArray(layout?.order) ? layout.order : []
  const hidden: string[] = Array.isArray(layout?.hidden) ? layout.hidden : []

  const byHref = new Map(items.map((i) => [i.href, i]))
  const out: typeof defaultShortcuts = []
  for (const href of order) {
    const it = byHref.get(href)
    if (!it) continue
    if (hidden.includes(href)) continue
    out.push(it)
    byHref.delete(href)
  }
  for (const it of byHref.values()) {
    if (hidden.includes(it.href)) continue
    out.push(it)
  }
  return out
}

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    partnersCount,
    processesCount,
    teamCount,
    lastPartners,
    lastProcesses,
    lastReport,
  ] = await Promise.all([
    supabase.from("partners").select("*", { count: "exact", head: true }),
    supabase.from("processes").select("*", { count: "exact", head: true }),
    supabase.from("team_members").select("*", { count: "exact", head: true }),
    supabase
      .from("partners")
      .select("id,name,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("processes")
      .select("id,name,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("partner_monthly_reports")
      .select("month,file_url,created_at")
      .order("created_at", { ascending: false })
      .limit(1),
  ])

  const { data: layoutRow } = user
    ? await supabase
        .from("user_layouts")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", "dashboard.shortcuts")
        .maybeSingle()
    : { data: null as any }

  const shortcuts = applyLayout(defaultShortcuts, layoutRow?.value ?? null)

  const stats = [
    { label: "Parceiros", value: partnersCount.count ?? 0, href: "/parceiros" },
    { label: "Processos", value: processesCount.count ?? 0, href: "/processos" },
    { label: "Time", value: teamCount.count ?? 0, href: "/time" },
    { label: "Relatórios", value: "Mensal", href: "/relatorios/parceiros" },
  ]
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        Dashboard
      </h1>

      <AlertBanner
        items={[
          {
            title: "Visão geral",
            description:
              "Acompanhe parceiros, processos e indicadores. O RBAC e o organograma já estão prontos para evoluir para integração com AD (somente leitura).",
          },
        ]}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20"
          >
            <div className="text-xs text-muted">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.value}</div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20"
          >
            <div className="text-sm text-muted">Acessar</div>
            <div className="text-lg font-medium">{item.label}</div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Atualizações recentes</div>
            <Link className="text-xs text-muted underline" href="/relatorios/parceiros">
              gerar relatório mensal
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted mb-2">Parceiros</div>
              <ul className="space-y-1">
                {(lastPartners.data ?? []).map((p: any) => (
                  <li key={p.id} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted shrink-0">
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}
                    </span>
                  </li>
                ))}
                {!lastPartners.data?.length ? <li className="text-xs text-muted">Sem dados ainda.</li> : null}
              </ul>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted mb-2">Processos</div>
              <ul className="space-y-1">
                {(lastProcesses.data ?? []).map((p: any) => (
                  <li key={p.id} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted shrink-0">
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}
                    </span>
                  </li>
                ))}
                {!lastProcesses.data?.length ? <li className="text-xs text-muted">Sem dados ainda.</li> : null}
              </ul>
            </div>
          </div>
          {lastReport.data?.[0]?.file_url ? (
            <div className="text-xs text-muted">
              Último relatório de parceiros:{" "}
              <a className="underline" href={lastReport.data[0].file_url} target="_blank">
                {lastReport.data[0].month}
              </a>
            </div>
          ) : (
            <div className="text-xs text-muted">Nenhum relatório mensal gerado ainda.</div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-medium">Ações rápidas</div>
          <div className="space-y-2">
            <Link className="block rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20" href="/parceiros">
              Cadastrar / gerenciar parceiro
            </Link>
            <Link className="block rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20" href="/processos">
              Criar processo + anexos
            </Link>
            <Link className="block rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20" href="/time">
              Organograma + RBAC
            </Link>
            <Link className="block rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-foreground/20" href="/configuracoes/aparencia">
              Ajustar aparência
            </Link>
          </div>
          <div className="text-xs text-muted">
            Dica: personalize o layout em <span className="underline">Configurações → Layout</span>.
          </div>
        </div>
      </section>
    </div>
  )
}
