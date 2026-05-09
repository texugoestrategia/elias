"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function SignInForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const credentialsAction = async (formData: FormData) => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const email = String(formData.get("email") ?? "")
      const password = String(formData.get("password") ?? "")

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      router.push("/")
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? "Falha ao entrar")
    } finally {
      setLoading(false)
    }
  }

  const resetPasswordAction = async (formData: FormData) => {
    setError(null)
    setMessage(null)
    setResetLoading(true)
    try {
      const email = String(formData.get("email") ?? "")
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/account/update-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
      setMessage("Se esse email existir, enviaremos um link de recuperação. Verifique sua caixa de entrada.")
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar link de recuperação")
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form action={credentialsAction} className="space-y-3">
      <label className="block space-y-1">
        <div className="text-xs text-muted">Email</div>
        <input
          name="email"
          type="email"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          autoComplete="email"
          required
        />
      </label>
      <label className="block space-y-1">
        <div className="text-xs text-muted">Senha</div>
        <input
          name="password"
          type="password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <div className="text-xs text-danger">{error}</div> : null}
      {message ? <div className="text-xs text-accent">{message}</div> : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
      </form>

      <form action={resetPasswordAction} className="pt-3 border-t border-border space-y-2">
        <div className="text-xs text-muted">
          Esqueceu a senha? Enviaremos um link de recuperação para o seu email.
        </div>
        <input
          name="email"
          type="email"
          placeholder="seu@email.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          autoComplete="email"
          required
        />
        <button
          type="submit"
          disabled={resetLoading}
          className="text-xs underline text-muted hover:text-foreground"
        >
          {resetLoading ? "Enviando..." : "Enviar link de recuperação"}
        </button>
      </form>
    </div>
  )
}
