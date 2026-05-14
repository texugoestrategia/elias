import Link from "next/link"

export default function ParceirosCertificacoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/parceiros" className="text-xs underline text-muted">
          ← Voltar para Parceiros
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Certificações (Parceiros)
        </h1>
        <p className="text-sm text-muted">
          Guia rápido para padronizar como registramos e usamos certificações de parceiros no comercial e no pré-vendas.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">O que registrar</div>
        <ul className="list-disc pl-5 text-sm text-muted space-y-2">
          <li>
            <span className="text-foreground/90">Nome da certificação</span> (ex.: “Partner Gold”, “ISO 27001”, “AWS Advanced”).
          </li>
          <li>
            <span className="text-foreground/90">Emissor</span> (ex.: fabricante, órgão certificador).
          </li>
          <li>
            <span className="text-foreground/90">Validade</span> (data de emissão e expiração, se houver).
          </li>
          <li>
            <span className="text-foreground/90">Evidência</span> (PDF/imagem/link do certificado).
          </li>
          <li>
            <span className="text-foreground/90">Observações</span> (escopo, regiões, restrições, pré-requisitos).
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Como usar no dia a dia</div>
        <ul className="list-disc pl-5 text-sm text-muted space-y-2">
          <li>
            <span className="text-foreground/90">Propostas</span>: destacar certificações que aumentam credibilidade e reduzem risco.
          </li>
          <li>
            <span className="text-foreground/90">Pré-vendas</span>: validar aderência a requisitos (compliance, segurança, entrega, etc.).
          </li>
          <li>
            <span className="text-foreground/90">Gestão</span>: acompanhar expiração/renovação e evitar “certificação vencida” em proposta.
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Sugestão de padrão (recomendado)</div>
        <div className="text-sm text-muted whitespace-pre-wrap">
          {`• Título: {Emissor} — {Certificação} ({Nível})
• Evidência: PDF ou link público
• Tags: segurança | cloud | compliance | indústria ...`}
        </div>
      </section>
    </div>
  )
}

