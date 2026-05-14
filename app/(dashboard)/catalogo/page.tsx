import { createClient } from "@/lib/supabase/server"
import { CatalogListClient } from "@/components/catalog/catalog-list-client"
import Link from "next/link"

export default async function CatalogoPage() {
  const supabase = createClient()

  const { data } = await supabase
    .from("partner_catalog_items")
    .select("id,name,kind,description,image_url,partner_id, partners:partners(id,name,is_internal,logo_url), node:partner_catalog_nodes(id,name)")
    .order("created_at", { ascending: false })
    .limit(500)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Link href="/catalogo/novo" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black">
          Novo item
        </Link>
      </div>
      <CatalogListClient initialItems={(data ?? []) as any} />
    </div>
  )
}
