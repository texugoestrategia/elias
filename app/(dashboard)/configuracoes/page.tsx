import Link from "next/link"

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Configurações
        </h1>
        <p className="text-sm text-muted">Telas mais curtas e objetivas. Ajustes avançados ficam dentro de cada seção.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/configuracoes/aparencia" className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
          <div className="text-sm font-medium">Aparência</div>
          <div className="text-xs text-muted mt-1">Tema, cores, tipografia e densidade.</div>
        </Link>
        <Link href="/configuracoes/layout" className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
          <div className="text-sm font-medium">Layout</div>
          <div className="text-xs text-muted mt-1">Sidebar e atalhos do dashboard.</div>
        </Link>
      </div>
    </div>
  )
}

