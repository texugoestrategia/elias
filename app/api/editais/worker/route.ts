import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { evaluateRuleSetTree } from "@/lib/editais/rules"

type Stage = "extract" | "classify" | "normalize" | "evaluate" | "conclude"

function nextStage(stage: Stage): Stage | null {
  switch (stage) {
    case "extract":
      return "classify"
    case "classify":
      return "normalize"
    case "normalize":
      return "evaluate"
    case "evaluate":
      return "conclude"
    case "conclude":
      return null
  }
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const ab = await blob.arrayBuffer()
  return Buffer.from(ab)
}

async function extractTextFromPdf(buf: Buffer): Promise<string> {
  // pdf-parse é commonjs
  const mod: any = await import("pdf-parse")
  const pdfParse = mod.default ?? mod
  const out = await pdfParse(buf)
  return String(out?.text ?? "")
}

function parseLikelyDeadline(text: string): string | null {
  // MVP: encontra datas dd/mm/aaaa e escolhe a mais próxima no futuro
  const matches = Array.from(text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g))
  const candidates: Date[] = []
  for (const m of matches) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yyyy = Number(m[3])
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 23, 59, 59))
    if (!Number.isNaN(d.getTime())) candidates.push(d)
  }
  const now = Date.now()
  const future = candidates.filter((d) => d.getTime() > now)
  future.sort((a, b) => a.getTime() - b.getTime())
  return future[0]?.toISOString() ?? null
}

function urgencyFromDeadline(deadlineAt: string | null): number {
  if (!deadlineAt) return 0
  const d = new Date(deadlineAt)
  if (Number.isNaN(d.getTime())) return 0
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  // Quanto menor o número de dias, maior a prioridade (0..100)
  return Math.max(0, Math.min(100, 100 - days * 5))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get("batch")
  if (!batchId) return Response.json({ error: "batch é obrigatório" }, { status: 400 })

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 })

  // claim 1 job
  const { data: claimed, error: cErr } = await supabase.rpc("claim_next_edital_job", {
    p_batch_id: batchId,
    p_lock_minutes: 5,
  })
  if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
  const row = Array.isArray(claimed) ? claimed[0] : claimed
  if (!row?.job_id) return Response.json({ done: true })

  const jobId: string = row.job_id
  const editalId: string = row.edital_id
  const stage: Stage = row.current_stage

  const startRun = async () => {
    const { data, error } = await supabase
      .from("edital_stage_runs")
      .insert({ job_id: jobId, stage, status: "running", log: {} })
      .select("id")
      .single()
    if (error) throw error
    return data.id as string
  }

  const finishRun = async (runId: string, status: "done" | "error", log: any) => {
    await supabase
      .from("edital_stage_runs")
      .update({ status, ended_at: new Date().toISOString(), log })
      .eq("id", runId)
  }

  const failJob = async (err: any, runId?: string) => {
    const msg = err?.message ?? String(err)
    if (runId) await finishRun(runId, "error", { error: msg })
    await supabase
      .from("edital_jobs")
      .update({
        status: "error",
        last_error: msg,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
    await supabase.from("editais").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", editalId)
  }

  const runId = await startRun()

  try {
    // common: pega arquivo
    const { data: edital, error: eErr } = await supabase
      .from("editais")
      .select("id,batch_id,file_id")
      .eq("id", editalId)
      .single()
    if (eErr) throw eErr

    const { data: file, error: fErr } = await supabase
      .from("edital_files")
      .select("storage_path,original_filename,mime_type,size_bytes")
      .eq("id", edital.file_id)
      .single()
    if (fErr) throw fErr

    if (stage === "extract") {
      const { data: blob, error: dErr } = await supabase.storage.from("editais").download(file.storage_path)
      if (dErr) throw dErr
      const buf = await blobToBuffer(blob as any)
      const isPdf =
        (file.mime_type ?? "").toLowerCase().includes("pdf") || String(file.original_filename).toLowerCase().endsWith(".pdf")

      let text = ""
      let confidence = 0.2
      if (isPdf) {
        text = await extractTextFromPdf(buf)
        confidence = text.trim().length ? 0.75 : 0.15
      }

      await supabase.from("edital_extractions").upsert({
        edital_id: editalId,
        text,
        sections: { raw: text.slice(0, 5000) },
        confidence,
        updated_at: new Date().toISOString(),
      })
    }

    if (stage === "classify") {
      const { data: ext } = await supabase.from("edital_extractions").select("text").eq("edital_id", editalId).maybeSingle()
      const t = (ext?.text ?? "").toLowerCase()
      const modality =
        t.includes("pregão") ? "pregao" : t.includes("concorrência") ? "concorrencia" : t.includes("dispensa") ? "dispensa" : "desconhecido"

      const deadlineAt = parseLikelyDeadline(String(ext?.text ?? ""))
      if (deadlineAt) {
        const urgency = urgencyFromDeadline(deadlineAt)
        await supabase.from("editais").update({ deadline_at: deadlineAt, urgency_score: urgency }).eq("id", editalId)
      }

      await supabase.from("edital_classifications").upsert({
        edital_id: editalId,
        data: { modality, inferred: true, deadline_guess: deadlineAt },
        updated_at: new Date().toISOString(),
      })
    }

    if (stage === "normalize") {
      const { data: ext } = await supabase.from("edital_extractions").select("text").eq("edital_id", editalId).maybeSingle()
      const text = String(ext?.text ?? "")

      const requirements: any[] = []
      const unknown: any[] = []

      // Normaliza via dicionário (regex/contains)
      const { data: dict } = await supabase.from("edital_term_dictionary").select("pattern,internal_key,kind")
      for (const d of dict ?? []) {
        const pat = String((d as any).pattern ?? "")
        const internalKey = String((d as any).internal_key ?? "")
        const kind = String((d as any).kind ?? "regex")

        let matched = false
        if (kind === "contains") {
          matched = text.toLowerCase().includes(pat.toLowerCase())
        } else {
          try {
            matched = new RegExp(pat, "i").test(text)
          } catch {
            matched = false
          }
        }

        if (matched) {
          requirements.push({
            key: internalKey,
            required: true,
            evidence: `Match: ${pat}`,
          })
        }
      }

      // Heurística simples de termos: encontra ISO XXXX e envia para fila se não mapeado
      const isoMatches = Array.from(text.matchAll(/ISO\s*\d{4,5}/gi)).map((m) => m[0])
      for (const term of isoMatches) {
        const already = requirements.some((r) => String(r.key).toLowerCase().includes(term.replace(/\s+/g, "_").toLowerCase()))
        const dictHit = (dict ?? []).some((d: any) => {
          try {
            return new RegExp(String(d.pattern), "i").test(term)
          } catch {
            return false
          }
        })
        if (!already && !dictHit) unknown.push({ term, context: term })
      }

      await supabase.from("edital_normalizations").upsert({
        edital_id: editalId,
        requirements,
        unknown_terms: unknown,
        updated_at: new Date().toISOString(),
      })

      // cria fila (deduplicado por edital+term)
      for (const u of unknown) {
        await supabase.from("edital_unknown_terms").upsert(
          {
            batch_id: batchId,
            edital_id: editalId,
            term: u.term,
            context: u.context ?? null,
            status: "open",
          },
          { onConflict: "edital_id,term" }
        )
      }
    }

    if (stage === "evaluate") {
      const [{ data: norm }, { data: ext }, { data: caps }, { data: ruleSet }, { data: cls }, { data: editalRow }] =
        await Promise.all([
        supabase.from("edital_normalizations").select("requirements").eq("edital_id", editalId).maybeSingle(),
        supabase.from("edital_extractions").select("confidence").eq("edital_id", editalId).maybeSingle(),
        supabase.from("company_capabilities").select("key,value"),
        supabase.from("edital_rule_sets").select("id").eq("key", "default").maybeSingle(),
        supabase.from("edital_classifications").select("data").eq("edital_id", editalId).maybeSingle(),
        supabase.from("editais").select("deadline_at,urgency_score").eq("id", editalId).maybeSingle(),
      ])

      const reqs: any[] = Array.isArray(norm?.requirements) ? (norm?.requirements as any[]) : []
      const capabilityMap: Record<string, any> = {}
      for (const c of caps ?? []) capabilityMap[(c as any).key] = (c as any).value

      const { data: vers } = ruleSet?.id
        ? await supabase
            .from("edital_rule_set_versions")
            .select("version,tree,status")
            .eq("rule_set_id", ruleSet.id)
            .eq("status", "published")
            .order("version", { ascending: false })
            .limit(1)
        : { data: [] as any[] }

      // fallback rule tree (se não tiver versão publicada ainda)
      const tree = (vers?.[0]?.tree as any) ?? {
        rules: [
          {
            type: "rule",
            id: "ko_iso_9001",
            ruleType: "KO",
            title: "ISO 9001",
            message: "Exige ISO 9001 vigente.",
            when: { type: "condition", field: "capability", key: "certificacao.iso_9001", operator: "eq", value: true },
          },
          {
            type: "rule",
            id: "score_iso_27001",
            ruleType: "SCORE",
            title: "Bônus ISO 27001",
            weight: 5,
            when: { type: "condition", field: "capability", key: "certificacao.iso_27001", operator: "eq", value: true },
          },
          {
            type: "rule",
            id: "info_low_confidence",
            ruleType: "INFO",
            title: "Confiança mínima da extração",
            message: "Extração com confiança baixa pode exigir revisão humana.",
            when: { type: "condition", field: "extraction.confidence", operator: "gte", value: 0.35 },
          },
        ],
      }

      const result = evaluateRuleSetTree(tree, {
        capabilities: capabilityMap,
        requirements: reqs,
        extraction: { confidence: Number(ext?.confidence ?? 0) },
        classification: (cls?.data as any) ?? {},
        edital: { deadline_at: editalRow?.deadline_at ?? null, urgency_score: editalRow?.urgency_score ?? null },
      })

      await supabase.from("edital_evaluations").upsert({
        edital_id: editalId,
        verdict: result.verdict,
        score: result.score,
        gaps: result.gaps,
        recommendations: result.recommendations,
        rule_set_id: ruleSet?.id ?? null,
        rule_set_version: vers?.[0]?.version ?? null,
        updated_at: new Date().toISOString(),
      })

      if (ruleSet?.id) {
        await supabase.from("edital_rule_audits").insert({
          edital_id: editalId,
          rule_set_id: ruleSet.id,
          version: vers?.[0]?.version ?? 0,
          verdict: result.verdict,
          score: result.score,
          details: result.audit,
        })
      }

      await supabase
        .from("editais")
        .update({ verdict: result.verdict, score: result.score, updated_at: new Date().toISOString() })
        .eq("id", editalId)
    }

    if (stage === "conclude") {
      await supabase.from("editais").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", editalId)
    }

    const n = nextStage(stage)
    if (n) {
      await supabase
        .from("edital_jobs")
        .update({
          current_stage: n,
          status: "queued",
          last_error: null,
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
      await supabase.from("editais").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", editalId)
    } else {
      await supabase
        .from("edital_jobs")
        .update({ status: "done", locked_at: null, locked_by: null, updated_at: new Date().toISOString() })
        .eq("id", jobId)
    }

    await finishRun(runId, "done", { ok: true })

    // Atualiza status do lote e cria notificação quando terminar
    const { data: all } = await supabase.from("editais").select("status").eq("batch_id", batchId)
    const total = all?.length ?? 0
    const done = (all ?? []).filter((x: any) => x.status === "done").length
    const err = (all ?? []).filter((x: any) => x.status === "error").length
    const processing = (all ?? []).filter((x: any) => x.status === "processing" || x.status === "queued").length

    await supabase
      .from("edital_batches")
      .update({
        total_files: total,
        processed_files: done,
        error_files: err,
        status: processing === 0 ? (err > 0 ? "error" : "done") : "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId)

    if (processing === 0) {
      await supabase.from("user_notifications").insert({
        user_id: user.id,
        type: "edital_batch_done",
        title: "Lote de editais finalizado",
        body: `Lote finalizado com ${done} concluído(s) e ${err} erro(s).`,
        meta: { batch_id: batchId },
      })

      // E-mail (opcional). Configure RESEND_API_KEY no Vercel para habilitar.
      if (process.env.RESEND_API_KEY && user.email) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM ?? "Mimir <no-reply@mimir.local>",
              to: [user.email],
              subject: "Mimir — Lote de editais finalizado",
              html: `<p>Seu lote de editais foi finalizado.</p><p><b>Concluídos:</b> ${done}<br/><b>Erros:</b> ${err}</p>`,
            }),
          })
        } catch {
          // não bloqueia o fluxo
        }
      }
    }

    return Response.json({ done: false, processed: { jobId, stage } })
  } catch (err: any) {
    await failJob(err, runId)
    return Response.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
