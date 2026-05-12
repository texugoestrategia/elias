"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function Topbar() {
  const router = useRouter()
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setName(data.user?.email ?? null)
    })
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
        <div className="text-sm">Olá{name ? `, ${name}` : ""}</div>
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
