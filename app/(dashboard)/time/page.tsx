import Link from "next/link"

export default function TimePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Time
        </h1>
        <p className="text-sm text-muted">Escolha uma área. Mantemos as telas mais limpas e focadas (mais cliques, menos confusão).</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/time/membros" className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
          <div className="text-sm font-medium">Membros</div>
          <div className="text-xs text-muted mt-1">Lista e detalhes (somente leitura).</div>
        </Link>
        <Link href="/time/organograma" className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
          <div className="text-sm font-medium">Organograma</div>
          <div className="text-xs text-muted mt-1">Visual + drag & drop.</div>
        </Link>
        <Link href="/time/rbac" className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
          <div className="text-sm font-medium">RBAC</div>
          <div className="text-xs text-muted mt-1">Papéis e permissões.</div>
        </Link>
        <Link href="/time/gerenciar" className="rounded-lg border border-border bg-surface p-4 hover:border-foreground/20">
          <div className="text-sm font-medium">Gerenciar</div>
          <div className="text-xs text-muted mt-1">Área completa (cadastro/edição).</div>
        </Link>
      </div>
    </div>
  )
}
