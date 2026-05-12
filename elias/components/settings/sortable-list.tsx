"use client"

import { CSS } from "@dnd-kit/utilities"
import { useSortable } from "@dnd-kit/sortable"

export type SortableItem = {
  id: string
  label: string
  description?: string
}

export function SortableRow({
  item,
  hidden,
  onToggleHidden,
}: {
  item: SortableItem
  hidden: boolean
  onToggleHidden: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
    >
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab select-none rounded border border-border px-2 py-1 text-xs text-muted hover:border-foreground/20"
          title="Arrastar"
        >
          ⋮⋮
        </button>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {item.label} {hidden ? <span className="text-xs text-muted">(oculto)</span> : null}
          </div>
          {item.description ? <div className="text-xs text-muted">{item.description}</div> : null}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted shrink-0">
        <input type="checkbox" checked={!hidden} onChange={() => onToggleHidden(item.id)} />
        Visível
      </label>
    </div>
  )
}

