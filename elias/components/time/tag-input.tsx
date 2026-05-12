"use client"

import { useMemo, useState } from "react"

export function TagInput({
  value,
  onChange,
  placeholder = "Digite e pressione Enter…",
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [text, setText] = useState("")

  const normalized = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const t of value) {
      const s = t.trim()
      if (!s) continue
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
    return out
  }, [value])

  const addFromText = () => {
    const raw = text.trim()
    if (!raw) return
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
    onChange([...normalized, ...parts])
    setText("")
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {normalized.map((tag) => (
          <button
            type="button"
            key={tag}
            onClick={() => onChange(normalized.filter((t) => t !== tag))}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs hover:border-foreground/20"
            title="Remover"
          >
            <span>{tag}</span>
            <span className="text-muted">×</span>
          </button>
        ))}
        {!normalized.length ? <div className="text-xs text-muted">Sem skills ainda.</div> : null}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            addFromText()
          }
        }}
        onBlur={addFromText}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="text-xs text-muted">Dica: separe várias skills por vírgula.</div>
    </div>
  )
}

