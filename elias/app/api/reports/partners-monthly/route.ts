import { NextRequest } from "next/server"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"

import { createClient } from "@/lib/supabase/server"

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map((x) => Number(x))
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0))
  return { start, end }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ym = searchParams.get("month") ?? format(new Date(), "yyyy-MM")
  const { start, end } = monthRange(ym)

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response("Não autenticado", { status: 401 })
  }

  // Pega atualizações do mês (simples: updated_at dentro do intervalo)
  const [partnersRes, focalsRes, itemsRes, articlesRes] = await Promise.all([
    supabase
      .from("partners")
      .select("id,name,segment,updated_at")
      .gte("updated_at", start.toISOString())
      .lt("updated_at", end.toISOString())
      .order("updated_at", { ascending: false }),
    supabase
      .from("partner_focal_points")
      .select("id,partner_id,name,email,updated_at")
      .gte("updated_at", start.toISOString())
      .lt("updated_at", end.toISOString())
      .order("updated_at", { ascending: false }),
    supabase
      .from("partner_catalog_items")
      .select("id,partner_id,name,kind,updated_at")
      .gte("updated_at", start.toISOString())
      .lt("updated_at", end.toISOString())
      .order("updated_at", { ascending: false }),
    supabase
      .from("partner_catalog_item_articles")
      .select("id,item_id,title,updated_at")
      .gte("updated_at", start.toISOString())
      .lt("updated_at", end.toISOString())
      .order("updated_at", { ascending: false }),
  ])

  const title = `Relatório mensal de atualizações — ${format(start, "MMMM yyyy", { locale: ptBR })}`

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
          new Paragraph({
            children: [
              new TextRun({ text: "Gerado em: ", bold: true }),
              new TextRun(format(new Date(), "dd/MM/yyyy HH:mm")),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Usuário: ", bold: true }),
              new TextRun(user.email ?? user.id),
            ],
          }),
          new Paragraph(""),

          new Paragraph({ text: "Resumo", heading: HeadingLevel.HEADING_1 }),
          new Paragraph(
            `Parceiros atualizados: ${(partnersRes.data ?? []).length} · Pontos focais: ${(focalsRes.data ?? []).length} · Itens de catálogo: ${(itemsRes.data ?? []).length} · Artigos: ${(articlesRes.data ?? []).length}`
          ),
          new Paragraph(""),

          new Paragraph({ text: "Parceiros", heading: HeadingLevel.HEADING_1 }),
          ...(partnersRes.data ?? []).map(
            (p) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: p.name, bold: true }),
                  new TextRun(` (${p.segment ?? "—"}) — ${format(new Date(p.updated_at), "dd/MM/yyyy")}`),
                ],
              })
          ),
          ...(partnersRes.data ?? []).length ? [new Paragraph("")] : [new Paragraph("Nenhuma atualização.")],

          new Paragraph({ text: "Pontos focais", heading: HeadingLevel.HEADING_1 }),
          ...(focalsRes.data ?? []).map(
            (f) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: f.name, bold: true }),
                  new TextRun(` — ${f.email ?? "sem email"} — ${format(new Date(f.updated_at), "dd/MM/yyyy")}`),
                ],
              })
          ),
          ...(focalsRes.data ?? []).length ? [new Paragraph("")] : [new Paragraph("Nenhuma atualização.")],

          new Paragraph({ text: "Catálogo (itens)", heading: HeadingLevel.HEADING_1 }),
          ...(itemsRes.data ?? []).map(
            (i) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: i.name, bold: true }),
                  new TextRun(` — ${i.kind === "product" ? "Produto" : "Serviço"} — ${format(new Date(i.updated_at), "dd/MM/yyyy")}`),
                ],
              })
          ),
          ...(itemsRes.data ?? []).length ? [new Paragraph("")] : [new Paragraph("Nenhuma atualização.")],

          new Paragraph({ text: "Catálogo (artigos)", heading: HeadingLevel.HEADING_1 }),
          ...(articlesRes.data ?? []).map(
            (a) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: a.title, bold: true }),
                  new TextRun(` — ${format(new Date(a.updated_at), "dd/MM/yyyy")}`),
                ],
              })
          ),
          ...(articlesRes.data ?? []).length ? [new Paragraph("")] : [new Paragraph("Nenhuma atualização.")],
        ],
      },
    ],
  })

  const buf = await Packer.toBuffer(doc)
  const filename = `mimir-relatorio-parceiros-${ym}.docx`

  // Tenta salvar no Supabase Storage + registrar histórico (se tiver permissão)
  try {
    const path = `partners/${ym}/${filename}`
    const blob = new Blob([new Uint8Array(buf)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    const up = await supabase.storage.from("reports").upload(path, blob, { upsert: true })
    if (!up.error) {
      const { data } = supabase.storage.from("reports").getPublicUrl(path)
      await supabase.from("partner_monthly_reports").upsert({
        month: ym,
        file_path: path,
        file_url: data.publicUrl,
        created_by: user.id,
      })
    }
  } catch {
    // não bloqueia o download caso o histórico falhe
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
