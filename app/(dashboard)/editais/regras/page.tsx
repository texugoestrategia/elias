import { createClient } from "@/lib/supabase/server"
import { EditaisRulesClient } from "@/components/editais/rules-client"

export default async function EditaisRegrasPage() {
  const supabase = createClient()

  // UX simples: mostramos só o conjunto "default" e apenas a última versão publicada.
  const [{ data: ruleSet }, { data: version }, { data: batches }] = await Promise.all([
    supabase.from("edital_rule_sets").select("id,key,name,description,created_at").eq("key", "default").maybeSingle(),
    // última publicada do default (se existir)
    supabase
      .from("edital_rule_set_versions")
      .select("id,rule_set_id,version,status,tree,created_at")
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1),
    supabase.from("edital_batches").select("id,name,created_at").order("created_at", { ascending: false }).limit(50),
  ])

  return (
    <EditaisRulesClient
      initialRuleSet={(ruleSet ?? null) as any}
      initialPublishedVersion={((version ?? [])[0] ?? null) as any}
      initialBatches={(batches ?? []) as any}
    />
  )
}
