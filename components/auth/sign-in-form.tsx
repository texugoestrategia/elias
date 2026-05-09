"use client"

import { signIn } from "next-auth/react"

export function SignInForm() {
  const credentialsAction = async (formData: FormData) => {
    const username = String(formData.get("username") ?? "")
    const password = String(formData.get("password") ?? "")

    await signIn("credentials", {
      username,
      password,
      callbackUrl: "/",
    })
  }

  return (
    <form action={credentialsAction} className="space-y-3">
      <label className="block space-y-1">
        <div className="text-xs text-muted">Usuário</div>
        <input
          name="username"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          autoComplete="username"
        />
      </label>
      <label className="block space-y-1">
        <div className="text-xs text-muted">Senha</div>
        <input
          name="password"
          type="password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          autoComplete="current-password"
        />
      </label>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black"
      >
        Entrar
      </button>
    </form>
  )
}
