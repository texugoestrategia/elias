import { createClient } from "@/lib/supabase/server"
import { EditaisTermosClient } from "@/components/editais/termos-client"

export default async function EditaisTermosPage() {
  const supabase = createClient()
  const [{ data: terms }, { data: dict }] = await Promise.all([
    supabase
      .from("edital_unknown_terms")
      .select("id,batch_id,edital_id,term,context,status,resolved_to_key,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("edital_term_dictionary").select("id,pattern,internal_key,kind,created_at").order("created_at", { ascending: false }),
  ])

  return <EditaisTermosClient initialTerms={(terms ?? []) as any} initialDictionary={(dict ?? []) as any} />
}

