import { LayoutSettings } from "@/components/settings/layout-settings"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

const sidebarItems = [
  { id: "/", label: "Dashboard" },
  { id: "/parceiros", label: "Parceiros" },
  { id: "/catalogo", label: "Catálogo" },
  { id: "/time", label: "Time" },
  { id: "/processos", label: "Processos" },
  { id: "/editais", label: "Editais" },
  { id: "/relatorios", label: "Relatórios" },
  { id: "/configuracoes", label: "Configurações" },
]

const dashboardItems = [
  { id: "/parceiros", label: "Parceiros", description: "Acessar módulo de parceiros" },
  { id: "/catalogo", label: "Catálogo", description: "Produtos/serviços para propostas" },
  { id: "/time", label: "Time", description: "Gestão do time e skills" },
  { id: "/processos", label: "Processos", description: "Fluxos e acompanhamento" },
  { id: "/editais", label: "Editais", description: "Gestão de editais" },
]

export default async function LayoutPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [sidebarRow, dashRow] = user
    ? await Promise.all([
        supabase.from("user_layouts").select("value").eq("user_id", user.id).eq("key", "sidebar").maybeSingle(),
        supabase
          .from("user_layouts")
          .select("value")
          .eq("user_id", user.id)
          .eq("key", "dashboard.shortcuts")
          .maybeSingle(),
      ])
    : ([{ data: null }, { data: null }] as any)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/configuracoes" className="text-xs underline text-muted">
          ← Voltar para Configurações
        </Link>
      </div>
      <LayoutSettings
        sidebarItems={sidebarItems as any}
        dashboardItems={dashboardItems as any}
        initialSidebar={sidebarRow?.data?.value ?? null}
        initialDashboard={dashRow?.data?.value ?? null}
      />
    </div>
  )
}
