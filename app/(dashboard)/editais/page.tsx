import { createClient } from "@/lib/supabase/server"
import { EditaisBatchesClient } from "@/components/editais/batches-client"

export default async function EditaisPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from("edital_batches")
    .select("id,name,status,total_files,processed_files,error_files,created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  return <EditaisBatchesClient initialBatches={(data ?? []) as any} />
}
