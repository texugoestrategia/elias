"use client"

import { useEffect, useMemo, useState } from "react"

export function AppLogo({ size = 32 }: { size?: number }) {
  const [broken, setBroken] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("dark")

  useEffect(() => {
    const root = document.documentElement
    const mode = (root.dataset.themeMode ?? "dark") as "light" | "dark" | "system"

    const compute = () => {
      if (mode === "system") {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      }
      return mode === "light" ? "light" : "dark"
    }

    setTheme(compute())

    if (mode === "system" && window.matchMedia) {
      const mql = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => setTheme(compute())
      mql.addEventListener?.("change", handler)
      return () => mql.removeEventListener?.("change", handler)
    }
  }, [])

  const src = useMemo(() => {
    // dark: usar o logo branco (logo2.png). light: logo padrão.
    return theme === "dark" ? "/img/logo2.png" : "/img/logo.png"
  }, [theme])

  if (broken) return null

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt="Mimir"
      className="rounded-md border border-border bg-background object-contain"
      style={{ height: size, width: size }}
      onError={(e) => {
        // fallback simples: se o logo2 não existir ainda, cai pro logo padrão
        const img = e.currentTarget as HTMLImageElement
        if (img.src.includes("logo2.png")) img.src = "/img/logo.png"
        else setBroken(true)
      }}
    />
  )
}
