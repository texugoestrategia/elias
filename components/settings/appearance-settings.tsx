"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  ACCENTS,
  BACKGROUNDS,
  DEFAULT_PREFERENCES,
  type AccentKey,
  type BgType,
  type ThemeMode,
  type UserPreferences,
} from "@/lib/preferences/theme"

export function AppearanceSettings({ initial }: { initial: UserPreferences }) {
  const supabase = useMemo(() => createClient(), [])
  const [prefs, setPrefs] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES, ...initial })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const save = async (next: UserPreferences) => {
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!authData.user) throw new Error("Não autenticado")

      const { error } = await supabase.from("user_preferences").upsert({
        user_id: authData.user.id,
        ...next,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setPrefs(next)
      setMsg("Preferências salvas.")
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao salvar preferências")
    } finally {
      setSaving(false)
    }
  }

  const uploadBackground = async (file: File) => {
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      const user = authData.user
      if (!user) throw new Error("Não autenticado")

      const path = `user/${user.id}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from("backgrounds").upload(path, file, {
        upsert: true,
      })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("backgrounds").getPublicUrl(path)

      await save({ ...prefs, bg_type: "image", bg_image_url: data.publicUrl })
      setMsg("Imagem enviada. Preferências atualizadas.")
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao enviar imagem")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Aparência
        </h1>
        <p className="text-sm text-muted">
          Personalize sua visualização sem quebrar o UX (paletas e limites controlados).
        </p>
      </header>

      {err ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{err}</div>
      ) : null}
      {msg ? (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{msg}</div>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Tema</div>
        <select
          value={prefs.theme_mode}
          onChange={(e) => save({ ...prefs, theme_mode: e.target.value as ThemeMode })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={saving}
        >
          <option value="dark">Escuro</option>
          <option value="light">Claro</option>
          <option value="system">Sistema (placeholder)</option>
        </select>
        <div className="text-xs text-muted">
          Observação: “Sistema” usa o padrão atual por enquanto (podemos evoluir depois).
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Cor de destaque</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
            <button
              type="button"
              key={k}
              disabled={saving}
              onClick={() => save({ ...prefs, accent: k })}
              className={
                "rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-foreground/20 " +
                (prefs.accent === k ? "ring-2 ring-[hsl(var(--accent))]" : "")
              }
            >
              <div className="text-xs text-muted">Acento</div>
              <div className="font-medium">{ACCENTS[k].label}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Fundo</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ ...prefs, bg_type: "solid" as BgType, bg_image_url: null })}
            className={
              "rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-foreground/20 " +
              (prefs.bg_type === "solid" ? "ring-2 ring-[hsl(var(--accent))]" : "")
            }
          >
            <div className="font-medium">Cor sólida</div>
            <div className="text-xs text-muted">Seguro, ótimo para leitura.</div>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ ...prefs, bg_type: "image" as BgType })}
            className={
              "rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-foreground/20 " +
              (prefs.bg_type === "image" ? "ring-2 ring-[hsl(var(--accent))]" : "")
            }
          >
            <div className="font-medium">Imagem</div>
            <div className="text-xs text-muted">Aplicamos overlay automático para legibilidade.</div>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ ...DEFAULT_PREFERENCES, theme_mode: prefs.theme_mode })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-foreground/20"
          >
            <div className="font-medium">Reset</div>
            <div className="text-xs text-muted">Voltar ao padrão.</div>
          </button>
        </div>

        {prefs.bg_type === "solid" ? (
          <div className="space-y-2">
            <div className="text-xs text-muted">Escolha uma cor (paleta segura):</div>
            <select
              value={prefs.bg_color ?? ""}
              onChange={(e) => save({ ...prefs, bg_color: e.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={saving}
            >
              <option value="">Automático (segue tema)</option>
              {BACKGROUNDS.map((b) => (
                <option key={b.key} value={b.hsl}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted">Enviar imagem de fundo:</div>
            <input
              type="file"
              accept="image/*"
              disabled={saving}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                await uploadBackground(file)
                e.target.value = ""
              }}
              className="text-xs"
            />
            {prefs.bg_image_url ? (
              <div className="text-xs text-muted">
                Atual:{" "}
                <a className="underline" href={prefs.bg_image_url} target="_blank">
                  abrir
                </a>
                {" · "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => save({ ...prefs, bg_image_url: null, bg_type: "solid" })}
                >
                  remover
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Leitura</div>
        <label className="block space-y-1">
          <div className="text-xs text-muted">Tamanho da fonte</div>
          <select
            value={String(prefs.font_scale)}
            onChange={(e) => save({ ...prefs, font_scale: Number(e.target.value) })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={saving}
          >
            <option value="0.9">Compacto</option>
            <option value="1">Padrão</option>
            <option value="1.05">Grande</option>
            <option value="1.1">Extra grande</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.dense_mode}
            onChange={(e) => save({ ...prefs, dense_mode: e.target.checked })}
            disabled={saving}
          />
          Modo compacto (tabelas com menos espaçamento)
        </label>
      </section>
    </div>
  )
}

