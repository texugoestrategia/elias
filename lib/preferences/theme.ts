export type ThemeMode = "light" | "dark" | "system"

export type AccentKey = "emerald" | "blue" | "violet" | "amber" | "rose"

export type BgType = "solid" | "image"

export type UserPreferences = {
  theme_mode: ThemeMode
  accent: AccentKey
  bg_type: BgType
  bg_color: string | null // HSL triplet: "240 4% 3%"
  bg_image_url: string | null
  font_scale: number
  dense_mode: boolean
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme_mode: "dark",
  accent: "emerald",
  bg_type: "solid",
  bg_color: null,
  bg_image_url: null,
  font_scale: 1.0,
  dense_mode: false,
}

export const ACCENTS: Record<AccentKey, { label: string; hsl: string }> = {
  emerald: { label: "Verde", hsl: "160 69% 36%" },
  blue: { label: "Azul", hsl: "210 80% 56%" },
  violet: { label: "Violeta", hsl: "265 85% 65%" },
  amber: { label: "Âmbar", hsl: "38 92% 55%" },
  rose: { label: "Rosa", hsl: "350 85% 60%" },
}

export const BACKGROUNDS: Array<{ key: string; label: string; hsl: string }> = [
  { key: "default-dark", label: "Padrão (escuro)", hsl: "240 4% 3%" },
  { key: "graphite", label: "Grafite", hsl: "240 5% 6%" },
  { key: "midnight", label: "Azul noite", hsl: "220 30% 8%" },
  { key: "forest", label: "Verde petróleo", hsl: "170 20% 8%" },
  { key: "default-light", label: "Padrão (claro)", hsl: "0 0% 98%" },
]

export const PALETTES = {
  dark: {
    background: "240 4% 3%",
    surface: "240 4% 7%",
    border: "240 5% 13%",
    text_primary: "45 15% 94%",
    text_secondary: "45 3% 60%",
  },
  light: {
    background: "0 0% 98%",
    surface: "0 0% 100%",
    border: "240 6% 86%",
    text_primary: "240 10% 8%",
    text_secondary: "240 3% 38%",
  },
} as const

export function toCssVars(prefs?: Partial<UserPreferences>) {
  const p = { ...DEFAULT_PREFERENCES, ...prefs }
  const palette = p.theme_mode === "light" ? PALETTES.light : PALETTES.dark
  const background = p.bg_color ?? palette.background

  const overlayOpacity = p.bg_type === "image" && p.bg_image_url ? 0.78 : 1
  const bgImage = p.bg_type === "image" && p.bg_image_url ? `url('${p.bg_image_url}')` : "none"

  return {
    "--background": background,
    "--surface": palette.surface,
    "--border": palette.border,
    "--text-primary": palette.text_primary,
    "--text-secondary": palette.text_secondary,
    "--accent": ACCENTS[p.accent]?.hsl ?? ACCENTS.emerald.hsl,
    "--bg-image": bgImage,
    "--bg-overlay-opacity": String(overlayOpacity),
    "--font-scale": String(p.font_scale ?? 1),
  } as React.CSSProperties
}

