import { createClient } from "@/lib/supabase/server"
import { ProcessesClient } from "@/components/processes/processes-client"

export default async function ProcessosPage() {
  const supabase = createClient()
  const [{ data: areas }, { data: processes }] = await Promise.all([
    supabase.from("process_areas").select("id,name").order("name", { ascending: true }),
    supabase.from("processes").select("*").order("name", { ascending: true }),
  ])

  return <ProcessesClient initialAreas={areas ?? []} initialProcesses={processes ?? []} />
}
