import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { evaluateRuleSetTree } from "@/lib/editais/rules"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get("batch")
  const versionId = searchParams.get("versionId")
  if (!batchId || !versionId) return Response.json({ error: "batch e versionId são obrigatórios" }, { status: 400 })

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const [{ data: vers, error: vErr }, { data: caps, error: cErr }, { data: rows, error: rErr }] = await Promise.all([
    supabase.from("edital_rule_set_versions").select("id,version,tree,rule_set_id").eq("id", versionId).single(),
    supabase.from("company_capabilities").select("key,value"),
    supabase
      .from("editais")
      .select("id, edital_normalizations(requirements), edital_extractions(confidence)")
      .eq("batch_id", batchId),
  ])
  if (vErr) return Response.json({ error: vErr.message }, { status: 500 })
  if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
  if (rErr) return Response.json({ error: rErr.message }, { status: 500 })

  const capMap: Record<string, any> = {}
  for (const c of caps ?? []) capMap[(c as any).key] = (c as any).value

  const counts: Record<string, number> = { APTO: 0, INAPTO: 0, APTO_COM_RESSALVAS: 0, REVISAO_HUMANA: 0 }
  const topGaps: Record<string, number> = {}
  let total = 0

  for (const r of rows ?? []) {
    total += 1
    const reqs = (r as any).edital_normalizations?.requirements ?? []
    const conf = Number((r as any).edital_extractions?.confidence ?? 0)
    const res = evaluateRuleSetTree((vers as any).tree, {
      capabilities: capMap,
      requirements: Array.isArray(reqs) ? reqs : [],
      extraction: { confidence: conf },
      classification: {},
      edital: {},
    })
    counts[res.verdict] = (counts[res.verdict] ?? 0) + 1
    for (const g of res.gaps ?? []) {
      const k = g.key ?? g.ruleId ?? "gap"
      topGaps[k] = (topGaps[k] ?? 0) + 1
    }
  }

  const top = Object.entries(topGaps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => ({ key: k, count: v }))

  return Response.json({
    total,
    version: (vers as any).version,
    counts,
    top_gaps: top,
  })
}
