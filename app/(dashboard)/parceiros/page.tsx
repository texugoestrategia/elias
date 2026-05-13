import { PartnersListClient } from "@/components/partners/partners-list-client"
import { createClient } from "@/lib/supabase/server"

export default async function ParceirosPage() {
  const supabase = createClient()

  const { data: partners } = await supabase
    .from("partners")
    .select("id,name,segment,website,logo_url,priority,active")
    .order("priority", { ascending: false })
    .order("name", { ascending: true })

  return <PartnersListClient initialPartners={(partners ?? []) as any} />
}
