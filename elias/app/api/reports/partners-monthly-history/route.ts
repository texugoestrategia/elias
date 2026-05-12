import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response("Não autenticado", { status: 401 })

  const { data, error } = await supabase
    .from("partner_monthly_reports")
    .select("id,month,file_url,created_at")
    .order("month", { ascending: false })
    .limit(24)

  if (error) return new Response(error.message, { status: 500 })
  return Response.json(data ?? [])
}

