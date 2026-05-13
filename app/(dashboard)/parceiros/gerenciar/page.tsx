import { PartnersClient } from "@/components/partners/partners-client"
import { createClient } from "@/lib/supabase/server"

export default async function ParceirosGerenciarPage({ searchParams }: { searchParams: { partnerId?: string } }) {
  const supabase = createClient()

  const [{ data: partners }, { data: roles }] = await Promise.all([
    supabase.from("partners").select("*, focals:partner_focal_points(*)").order("priority", { ascending: false }).order("name", { ascending: true }),
    supabase.from("partner_contact_roles").select("*").order("name", { ascending: true }),
  ])

  const normalized = (partners ?? []).map((p: any) => ({
    ...p,
    tags: Array.isArray(p.tags) ? p.tags : [],
  }))

  return <PartnersClient initialPartners={normalized} initialRoles={roles ?? []} initialSelectedPartnerId={searchParams.partnerId ?? null} />
}

