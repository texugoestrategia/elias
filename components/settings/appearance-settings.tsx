"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  ACCENTS,
  BACKGROUNDS,
  DEFAULT_PREFERENCES,
  type AccentKey,
  type BgType,
  type ThemeMode,
  type UserPreferences,
  toCssVars,
} from "@/lib/preferences/theme"

function hexToHslTriplet(hex: string): string | null {
  const raw = hex.trim().replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  const r = parseInt(raw.slice(0, 2), 16) / 255
  const g = parseInt(raw.slice(2, 4), 16) / 255
  const b = parseInt(raw.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function AppearanceSettings({ initial }: { initial: UserPreferences }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [prefs, setPrefs] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES, ...initial })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [accentHex, setAccentHex] = useState("")
  const [bgHex, setBgHex] = useState("")

  const applyPreview = (next: UserPreferences) => {
    const vars = toCssVars(next) as any
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, String(v))
    }
    document.body.classList.toggle("dense", !!next.dense_mode)

    // Mantém data-attrs em sincronia (para o logo alternar light/dark sem refresh)
    document.documentElement.dataset.themeMode = next.theme_mode
    const resolved =
      next.theme_mode === "light"
        ? "light"
        : next.theme_mode === "dark"
          ? "dark"
          : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
    document.documentElement.dataset.theme = resolved
  }

  const save = async () => {
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!authData.user) throw new Error("Não autenticado")

      const { error } = await supabase.from("user_preferences").upsert({
        user_id: authData.user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setMsg("Preferências salvas. Aplicando…")
      router.refresh()
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

      setPrefs((p) => {
        const next = { ...p, bg_type: "image" as BgType, bg_image_url: data.publicUrl }
        applyPreview(next)
        return next
      })
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
          onChange={(e) => {
            const next = { ...prefs, theme_mode: e.target.value as ThemeMode }
            setPrefs(next)
            applyPreview(next)
          }}
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
          {(Object.keys(ACCENTS) as Exclude<AccentKey, "custom">[]).map((k) => (
            <button
              type="button"
              key={k}
              disabled={saving}
              onClick={() => {
                const next = { ...prefs, accent: k, accent_custom_hsl: null }
                setPrefs(next)
                applyPreview(next)
              }}
              className={
                "rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-foreground/20 " +
                (prefs.accent === k ? "ring-2 ring-[hsl(var(--accent))]" : "")
              }
            >
              <div className="text-xs text-muted">Acento</div>
              <div className="font-medium">{ACCENTS[k].label}</div>
            </button>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const next = { ...prefs, accent: "custom" as AccentKey }
              setPrefs(next)
              applyPreview(next)
            }}
            className={
              "rounded-md border border-border bg-background px-3 py-2 text-sm text-left hover:border-foreground/20 " +
              (prefs.accent === "custom" ? "ring-2 ring-[hsl(var(--accent))]" : "")
            }
          >
            <div className="text-xs text-muted">Acento</div>
            <div className="font-medium">Outro (HEX)</div>
          </button>
        </div>

        {prefs.accent === "custom" ? (
          <div className="space-y-2">
            <div className="text-xs text-muted">Digite uma cor HEX (ex.: #4F46E5):</div>
            <div className="flex gap-2">
              <input
                value={accentHex}
                onChange={(e) => setAccentHex(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="#4F46E5"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  const hsl = hexToHslTriplet(accentHex)
                  if (!hsl) {
                    setErr("HEX inválido. Use o formato #RRGGBB.")
                    return
                  }
                  const next = { ...prefs, accent: "custom" as AccentKey, accent_custom_hsl: hsl }
                  setPrefs(next)
                  applyPreview(next)
                }}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-foreground/20"
              >
                Aplicar
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Fundo</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const next = { ...prefs, bg_type: "solid" as BgType, bg_image_url: null }
              setPrefs(next)
              applyPreview(next)
            }}
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
            onClick={() => {
              const next = { ...prefs, bg_type: "image" as BgType }
              setPrefs(next)
              applyPreview(next)
            }}
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
            onClick={() => {
              const next = { ...DEFAULT_PREFERENCES, theme_mode: prefs.theme_mode }
              setPrefs(next)
              applyPreview(next)
            }}
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
              onChange={(e) => {
                const next = { ...prefs, bg_color: e.target.value || null }
                setPrefs(next)
                applyPreview(next)
              }}
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

            <div className="text-xs text-muted">Ou outro HEX (ex.: #0B0B0F):</div>
            <div className="flex gap-2">
              <input
                value={bgHex}
                onChange={(e) => setBgHex(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="#0B0B0F"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  const hsl = hexToHslTriplet(bgHex)
                  if (!hsl) {
                    setErr("HEX inválido. Use o formato #RRGGBB.")
                    return
                  }
                  const next = { ...prefs, bg_color: hsl }
                  setPrefs(next)
                  applyPreview(next)
                }}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-foreground/20"
              >
                Aplicar
              </button>
            </div>
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
                  onClick={() => {
                    const next = { ...prefs, bg_image_url: null, bg_type: "solid" as BgType }
                    setPrefs(next)
                    applyPreview(next)
                  }}
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
            onChange={(e) => {
              const next = { ...prefs, font_scale: Number(e.target.value) }
              setPrefs(next)
              applyPreview(next)
            }}
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
            onChange={(e) => {
              const next = { ...prefs, dense_mode: e.target.checked }
              setPrefs(next)
              applyPreview(next)
            }}
            disabled={saving}
          />
          Modo compacto (tabelas com menos espaçamento)
        </label>
      </section>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setPrefs({ ...DEFAULT_PREFERENCES, theme_mode: prefs.theme_mode })
            applyPreview({ ...DEFAULT_PREFERENCES, theme_mode: prefs.theme_mode } as any)
          }}
          className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:border-foreground/20 disabled:opacity-60"
        >
          Descartar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar e aplicar"}
        </button>
      </div>
    </div>
  )
}
