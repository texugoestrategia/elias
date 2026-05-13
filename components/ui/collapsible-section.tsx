"use client"

import { ReactNode } from "react"

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  right,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <details className="rounded-lg border border-border bg-surface p-4" open={defaultOpen}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{title}</div>
            {description ? <div className="text-xs text-muted mt-1">{description}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

