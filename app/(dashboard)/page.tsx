import Link from "next/link"
import { AlertBanner } from "@/components/layout/alert-banner"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        Dashboard
      </h1>

      <AlertBanner
        items={[
          {
            title: "Ambiente de desenvolvimento",
            description:
              "Este projeto foi inicializado e está pronto para evoluir com Supabase + NextAuth (Azure AD).",
          },
        ]}
      />

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/parceiros", label: "Parceiros" },
          { href: "/time", label: "Time" },
          { href: "/processos", label: "Processos" },
          { href: "/editais", label: "Editais" },
        ].map((item) => (
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

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="text-sm font-medium mb-2">Próximos passos</div>
        <ul className="list-disc pl-5 text-sm text-muted space-y-1">
          <li>Configurar variáveis de ambiente (Supabase/NextAuth/Azure AD)</li>
          <li>Adicionar shadcn/ui e componentes do design system</li>
          <li>Implementar o schema/migrations no Supabase</li>
        </ul>
      </section>
    </div>
  )
}

