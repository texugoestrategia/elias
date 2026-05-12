import { PartnersMonthlyClient } from "@/components/reports/partners-monthly-client"
import { createClient } from "@/lib/supabase/server"

export default async function RelatoriosParceirosPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = user
    ? await supabase
        .from("partner_monthly_reports")
        .select("id,month,file_url,created_at")
        .order("month", { ascending: false })
        .limit(24)
    : { data: [] as any[] }

  return <PartnersMonthlyClient initialReports={data ?? []} />
}
