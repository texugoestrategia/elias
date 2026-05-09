export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 space-y-3">
        <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Link inválido ou expirado
        </h1>
        <p className="text-sm text-muted">
          Esse link de autenticação/recuperação de senha não é mais válido. Volte para o login e solicite um novo
          link.
        </p>
        <a
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black"
        >
          Voltar para o login
        </a>
      </div>
    </div>
  )
}

