import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { CatalogCreateClient } from "@/components/catalog/catalog-create-client"

export default async function CatalogoNovoPage() {
  const supabase = createClient()

  const [{ data: partners }, { data: nodes }] = await Promise.all([
    supabase.from("partners").select("id,name,is_internal,priority,active").eq("active", true).order("is_internal", { ascending: false }).order("priority", { ascending: false }).order("name", { ascending: true }),
    supabase.from("partner_catalog_nodes").select("id,name,partner_id").order("name", { ascending: true }),
  ])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/catalogo" className="text-xs underline text-muted">
          ← Voltar para Catálogo
        </Link>
      </div>
      <CatalogCreateClient initialPartners={(partners ?? []) as any} initialNodes={(nodes ?? []) as any} />
    </div>
  )
}

