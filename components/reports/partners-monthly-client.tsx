"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CollapsibleSection } from "@/components/ui/collapsible-section"

type MonthlyReport = {
  id: string
  month: string
  file_url: string
  created_at: string
}

function currentMonth() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export function PartnersMonthlyClient({ initialReports }: { initialReports: MonthlyReport[] }) {
  const [month, setMonth] = useState(currentMonth())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reports, setReports] = useState<MonthlyReport[]>(initialReports)

  const href = useMemo(() => `/api/reports/partners-monthly?month=${encodeURIComponent(month)}`, [month])

  const download = async () => {
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const res = await fetch(href)
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `mimir-relatorio-parceiros-${month}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMessage("Relatório gerado. Se você rodou o bootstrap, ele também fica salvo em Relatórios (histórico).")
      // atualiza histórico em tela (se existir)
      try {
        const r = await fetch("/api/reports/partners-monthly-history")
        if (r.ok) setReports(await r.json())
      } catch {}
    } catch (e: any) {
      setError(e?.message ?? "Falha ao gerar relatório")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/relatorios" className="text-xs underline text-muted">
          ← Voltar para Relatórios
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Relatório — Parceiros
        </h1>
        <p className="text-sm text-muted">Geração mensal e histórico (detalhes ficam recolhidos por padrão).</p>
      </header>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted">{message}</div>
      ) : null}

      <CollapsibleSection
        title="Gerar relatório"
        description="Escolha o mês e clique em gerar. O arquivo é baixado e também pode aparecer no histórico."
        defaultOpen
      >
        <div className="space-y-3">
          <label className="block space-y-1">
            <div className="text-xs text-muted">Mês</div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={download}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            {loading ? "Gerando…" : "Gerar DOCX"}
          </button>

          <div className="text-xs text-muted">
            Dica: se não aparecer nada, é porque não houve alterações nesse mês (ou você ainda não rodou o SQL de catálogo).
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Histórico" description="Arquivos gerados anteriormente." defaultOpen={false}>
        {reports.length ? (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-md border border-border bg-background p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{r.month}</div>
                  <div className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <a className="text-xs underline text-muted" href={r.file_url} target="_blank">
                  Baixar
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted">
            Ainda não há histórico (ele aparece quando o SQL <code>reports</code> estiver rodado e um relatório for gerado).
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}
