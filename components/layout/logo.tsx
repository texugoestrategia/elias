"use client"

import { useState } from "react"

export function AppLogo({ size = 32 }: { size?: number }) {
  const [broken, setBroken] = useState(false)

  if (broken) return null

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/img/logo.png"
      alt="Mimir"
      className="rounded-md border border-border bg-background object-contain"
      style={{ height: size, width: size }}
      onError={() => setBroken(true)}
    />
  )
}

