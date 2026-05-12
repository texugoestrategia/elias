import { createClient } from "@/lib/supabase/server"
import { EditaisRulesClient } from "@/components/editais/rules-client"

export default async function EditaisRegrasPage() {
  const supabase = createClient()

  const [{ data: ruleSets }, { data: versions }, { data: batches }] = await Promise.all([
    supabase.from("edital_rule_sets").select("id,key,name,description,created_at").order("created_at", { ascending: false }),
    supabase
      .from("edital_rule_set_versions")
      .select("id,rule_set_id,version,status,tree,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("edital_batches").select("id,name,created_at").order("created_at", { ascending: false }).limit(50),
  ])

  return (
    <EditaisRulesClient
      initialRuleSets={(ruleSets ?? []) as any}
      initialVersions={(versions ?? []) as any}
      initialBatches={(batches ?? []) as any}
    />
  )
}

