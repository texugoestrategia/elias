import { SignInForm } from "@/components/auth/sign-in-form"

export default function LoginPage() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 space-y-4">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Entrar
        </h1>
        <p className="text-sm text-muted">
          Por enquanto estamos usando um usuário de teste (Credentials). Depois trocamos para Azure AD (SSO).
        </p>
        <SignInForm />
      </div>
    </div>
  )
}
