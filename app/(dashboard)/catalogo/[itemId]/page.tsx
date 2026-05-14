import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { CatalogItemClient } from "@/components/catalog/catalog-item-client"

export default async function CatalogoItemPage({ params }: { params: { itemId: string } }) {
  const supabase = createClient()
  const itemId = params.itemId

  const [{ data: item }, { data: nodes }, { data: images }, { data: reqs }, { data: articles }, { data: relations }] =
    await Promise.all([
      supabase
        .from("partner_catalog_items")
        .select(
          "*, partner:partners(id,name,is_internal,logo_url), node:partner_catalog_nodes(id,name,partner_id)"
        )
        .eq("id", itemId)
        .maybeSingle(),
      supabase.from("partner_catalog_nodes").select("id,name,partner_id").order("name", { ascending: true }),
      supabase.from("partner_catalog_item_images").select("*").eq("item_id", itemId).order("sort_order", { ascending: true }),
      supabase
        .from("partner_catalog_item_requirements")
        .select("*")
        .eq("item_id", itemId)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("partner_catalog_item_articles").select("*").eq("item_id", itemId).order("created_at", { ascending: false }),
      supabase
        .from("partner_catalog_item_relations")
        .select("id,relation_type,notes, related:partner_catalog_items(id,name,partner_id, partner:partners(id,name,is_internal))")
        .eq("item_id", itemId)
        .order("created_at", { ascending: false }),
    ])

  if (!item) {
    return <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">Item não encontrado.</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/catalogo" className="text-xs underline text-muted">
          ← Voltar para Catálogo
        </Link>
        <Link href={`/parceiros/${item.partner_id}`} className="text-xs underline text-muted">
          Ver parceiro
        </Link>
      </div>
      <CatalogItemClient
        initialItem={item as any}
        initialNodes={(nodes ?? []) as any}
        initialImages={(images ?? []) as any}
        initialRequirements={(reqs ?? []) as any}
        initialArticles={(articles ?? []) as any}
        initialRelations={(relations ?? []) as any}
      />
    </div>
  )
}

