"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function Topbar() {
  const router = useRouter()
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const u = data.user

      const fullName =
        (u?.user_metadata?.full_name as string | undefined) ||
        (u?.user_metadata?.name as string | undefined) ||
        (u?.user_metadata?.display_name as string | undefined) ||
        null

      const pic =
        (u?.user_metadata?.avatar_url as string | undefined) ||
        (u?.user_metadata?.picture as string | undefined) ||
        null

      const userEmail = u?.email ?? null
      setEmail(userEmail)

      // Fallback: se o Auth não estiver fornecendo name/picture, tenta ler do Time (team_members)
      if (userEmail) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("name,avatar_url")
          .eq("email", userEmail)
          .maybeSingle()

        const finalName = fullName || tm?.name || userEmail
        const finalPic = pic || tm?.avatar_url || null

        setName(finalName)
        setAvatarUrl(finalPic)
      } else {
        setName(fullName)
        setAvatarUrl(pic)
      }
    })()
  }, [])

  const onSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="h-14 border-b border-border bg-surface px-4 flex items-center justify-between">
      <div className="text-sm text-muted">Plataforma interna</div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full border border-border bg-background overflow-hidden flex items-center justify-center text-xs text-muted">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{(name ?? email ?? "?").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="leading-tight">
            <div className="text-sm">Olá{name ? `, ${name}` : ""}</div>
            {email && name !== email ? <div className="text-[11px] text-muted">{email}</div> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
        >
          Sair
        </button>
      </div>
    </header>
  )
}
