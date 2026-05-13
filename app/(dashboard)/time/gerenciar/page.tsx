import { createClient } from "@/lib/supabase/server"
import { TimeClient } from "@/components/time/time-client"

export default async function TimeGerenciarPage() {
  const supabase = createClient()

  const { data: members } = await supabase
    .from("team_members")
    .select("*, certificates:team_member_certificates(*)")
    .order("created_at", { ascending: false })

  const normalized = (members ?? []).map((m: any) => ({
    ...m,
    skills: Array.isArray(m.skills) ? m.skills : [],
  }))

  return <TimeClient initialMembers={normalized} />
}

