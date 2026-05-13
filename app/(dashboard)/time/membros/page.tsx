import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { TeamReadonlyClient } from "@/components/time/team-readonly-client"

export default async function TimeMembrosPage() {
  const supabase = createClient()

  const { data: members } = await supabase
    .from("team_members")
    .select("id,name,email,role,area,avatar_url,skills, certificates:team_member_certificates(id,title,issuer,issued_at,file_url)")
    .order("created_at", { ascending: false })

  const normalized = (members ?? []).map((m: any) => ({
    ...m,
    skills: Array.isArray(m.skills) ? m.skills : [],
  }))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Link href="/time/gerenciar" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black">
          Gerenciar
        </Link>
      </div>
      <TeamReadonlyClient initialMembers={normalized as any} />
    </div>
  )
}

