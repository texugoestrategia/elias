import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get("batch")
  const stage = (searchParams.get("stage") ?? "evaluate") as any
  if (!batchId) return Response.json({ error: "batch é obrigatório" }, { status: 400 })

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const { data, error } = await supabase.rpc("reset_edital_batch_from_stage", {
    p_batch_id: batchId,
    p_stage: stage,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, reset: data ?? 0 })
}

