import { auth, signOut } from "@/auth"

export async function Topbar() {
  const session = await auth()
  return (
    <header className="h-14 border-b border-border bg-surface px-4 flex items-center justify-between">
      <div className="text-sm text-muted">Plataforma interna</div>
      <div className="flex items-center gap-3">
        <div className="text-sm">Olá{session?.user?.name ? `, ${session.user.name}` : ""}</div>
        {session ? (
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
            >
              Sair
            </button>
          </form>
        ) : null}
      </div>
    </header>
  )
}
