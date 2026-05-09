export type AlertItem = {
  title: string
  description?: string
  variant?: "warning" | "danger" | "info"
}

export function AlertBanner({ items }: { items: AlertItem[] }) {
  if (!items?.length) return null

  return (
    <div className="border border-border bg-surface rounded-lg p-3">
      <div className="text-sm font-medium mb-2">Alertas</div>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm">
            <div className="font-medium">{item.title}</div>
            {item.description ? (
              <div className="text-muted text-xs">{item.description}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

