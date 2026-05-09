"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Garante que existe sessão (o link de recovery deve ter passado por /auth/confirm)
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("Sessão de recuperação não encontrada. Abra novamente o link enviado por email.")
      }
    })
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!password || password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("As senhas não conferem.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setMessage("Senha atualizada com sucesso. Você já pode continuar.")
      setTimeout(() => {
        router.push("/")
        router.refresh()
      }, 600)
    } catch (e: any) {
      setError(e?.message ?? "Falha ao atualizar senha")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 space-y-4">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Atualizar senha
        </h1>
        <p className="text-sm text-muted">
          Defina uma nova senha para sua conta. Se você chegou aqui pelo link do email, a sessão de recuperação já
          estará ativa.
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1">
            <div className="text-xs text-muted">Nova senha</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="block space-y-1">
            <div className="text-xs text-muted">Confirmar senha</div>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoComplete="new-password"
              required
            />
          </label>

          {error ? <div className="text-xs text-danger">{error}</div> : null}
          {message ? <div className="text-xs text-accent">{message}</div> : null}

          <button
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <a href="/login" className="text-xs text-muted underline">
          Voltar para o login
        </a>
      </div>
    </div>
  )
}

