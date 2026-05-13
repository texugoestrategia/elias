import Link from "next/link"

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Relatórios
        </h1>
        <p className="text-sm text-muted">Escolha um relatório. Detalhes e downloads ficam dentro de cada tela.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/relatorios/parceiros" className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
          <div className="text-sm font-medium">Parceiros (mensal)</div>
          <div className="text-xs text-muted mt-1">Gerar e acessar PDFs mensais.</div>
        </Link>
      </div>
    </div>
  )
}

