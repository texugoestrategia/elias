"use client"

import { useMemo } from "react"

type Op = "AND" | "OR"
type Operator = "present" | "absent" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in" | "not_in" | "between"
type Field = "capability" | "requirement" | "classification" | "edital" | "extraction"

type Tree =
  | {
      type: "group"
      _id: string
      op: Op
      children: Tree[]
    }
  | {
      type: "condition"
      _id: string
      field: Field
      key?: string
      operator: Operator
      value?: any
    }

export type RuleRowUI = {
  _id: string
  id: string
  title: string
  ruleType: "KO" | "SCORE" | "INFO"
  weight?: number
  message?: string
  when: Tree
}

function uuid() {
  // browser
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function attachIds(tree: any): Tree {
  if (!tree || typeof tree !== "object") {
    return { type: "condition", _id: uuid(), field: "capability", key: "", operator: "eq", value: true }
  }
  if (tree.type === "group") {
    return {
      type: "group",
      _id: tree._id ?? uuid(),
      op: tree.op === "OR" ? "OR" : "AND",
      children: Array.isArray(tree.children) ? tree.children.map(attachIds) : [],
    }
  }
  if (tree.type === "condition") {
    return {
      type: "condition",
      _id: tree._id ?? uuid(),
      field: tree.field ?? "capability",
      key: tree.key ?? "",
      operator: tree.operator ?? "eq",
      value: tree.value,
    }
  }
  return { type: "condition", _id: uuid(), field: "capability", key: "", operator: "eq", value: true }
}

function stripIds(tree: Tree): any {
  if (tree.type === "group") {
    return { type: "group", op: tree.op, children: tree.children.map(stripIds) }
  }
  const out: any = { type: "condition", field: tree.field, operator: tree.operator }
  if (tree.key) out.key = tree.key
  if (tree.operator !== "present" && tree.operator !== "absent") out.value = tree.value
  return out
}

export function normalizeRulesFromTreeJson(treeJson: any): RuleRowUI[] {
  const rules = Array.isArray(treeJson?.rules) ? treeJson.rules : []
  return rules.map((r: any) => ({
    _id: r._id ?? uuid(),
    id: r.id ?? uuid(),
    title: r.title ?? "Regra",
    ruleType: r.ruleType ?? "KO",
    weight: r.weight,
    message: r.message,
    when: attachIds(r.when ?? { type: "group", op: "AND", children: [] }),
  }))
}

export function toTreeJsonFromRules(rules: RuleRowUI[]) {
  return {
    rules: rules.map((r) => ({
      type: "rule",
      id: r.id,
      title: r.title,
      ruleType: r.ruleType,
      weight: r.ruleType === "SCORE" ? Number(r.weight ?? 0) : undefined,
      message: r.message ?? undefined,
      when: stripIds(r.when),
    })),
  }
}

type FieldOption = { field: Field; key: string; label: string; valueType: "boolean" | "number" | "string" | "enum" }

function fieldCatalog(): FieldOption[] {
  return [
    { field: "capability", key: "certificacao.iso_9001", label: "Certificação: ISO 9001", valueType: "boolean" },
    { field: "capability", key: "certificacao.iso_27001", label: "Certificação: ISO 27001", valueType: "boolean" },
    { field: "extraction", key: "confidence", label: "Extração: confiança", valueType: "number" },
    { field: "classification", key: "modality", label: "Classificação: modalidade", valueType: "enum" },
    { field: "edital", key: "deadline_at", label: "Edital: prazo (dias até)", valueType: "number" },
    { field: "edital", key: "urgency_score", label: "Edital: urgência (0-100)", valueType: "number" },
    { field: "requirement", key: "certificacao.iso_9001", label: "Requisito: ISO 9001 (detectado)", valueType: "boolean" },
  ]
}

function operatorOptions(valueType: FieldOption["valueType"]): Array<{ op: Operator; label: string }> {
  const common = [
    { op: "present" as const, label: "Está presente" },
    { op: "absent" as const, label: "Está ausente" },
  ]
  const text = [
    { op: "eq" as const, label: "Igual a" },
    { op: "neq" as const, label: "Diferente de" },
    { op: "contains" as const, label: "Contém" },
    { op: "in" as const, label: "Em (lista)" },
    { op: "not_in" as const, label: "Não em (lista)" },
  ]
  const num = [
    { op: "eq" as const, label: "Igual a" },
    { op: "neq" as const, label: "Diferente de" },
    { op: "gt" as const, label: "Maior que" },
    { op: "gte" as const, label: "Maior ou igual" },
    { op: "lt" as const, label: "Menor que" },
    { op: "lte" as const, label: "Menor ou igual" },
    { op: "between" as const, label: "Entre" },
    { op: "in" as const, label: "Em (lista)" },
    { op: "not_in" as const, label: "Não em (lista)" },
  ]
  if (valueType === "number") return [...common, ...num]
  if (valueType === "boolean") return [...common, { op: "eq", label: "Igual a" }, { op: "neq", label: "Diferente de" }]
  if (valueType === "enum") return [...common, { op: "eq", label: "Igual a" }, { op: "neq", label: "Diferente de" }, { op: "in", label: "Em (lista)" }]
  return [...common, ...text]
}

export function RuleBuilder({
  value,
  onChange,
}: {
  value: RuleRowUI[]
  onChange: (next: RuleRowUI[]) => void
}) {
  const catalog = useMemo(() => fieldCatalog(), [])

  const addRule = () => {
    onChange([
      ...value,
      {
        _id: uuid(),
        id: `rule_${Math.random().toString(36).slice(2, 8)}`,
        title: "Nova regra",
        ruleType: "KO",
        message: "",
        when: { type: "group", _id: uuid(), op: "AND", children: [] },
      },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Regras</div>
        <button
          type="button"
          onClick={addRule}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/20"
        >
          + Adicionar regra
        </button>
      </div>

      <div className="space-y-3">
        {value.map((r) => (
          <RuleCard
            key={r._id}
            rule={r}
            catalog={catalog}
            onChange={(next) => onChange(value.map((x) => (x._id === r._id ? next : x)))}
            onDelete={() => onChange(value.filter((x) => x._id !== r._id))}
          />
        ))}
        {!value.length ? <div className="text-xs text-muted">Nenhuma regra ainda.</div> : null}
      </div>
    </div>
  )
}

function RuleCard({
  rule,
  catalog,
  onChange,
  onDelete,
}: {
  rule: RuleRowUI
  catalog: FieldOption[]
  onChange: (r: RuleRowUI) => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 w-full space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              value={rule.title}
              onChange={(e) => onChange({ ...rule, title: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
              placeholder="Título da regra"
            />
            <select
              value={rule.ruleType}
              onChange={(e) => onChange({ ...rule, ruleType: e.target.value as any })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="KO">Eliminatória (KO)</option>
              <option value="SCORE">Pontuável</option>
              <option value="INFO">Informativa</option>
            </select>
          </div>

          {rule.ruleType === "SCORE" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={String(rule.weight ?? 0)}
                onChange={(e) => onChange({ ...rule, weight: Number(e.target.value) })}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Peso"
                inputMode="numeric"
              />
              <input
                value={rule.id}
                onChange={(e) => onChange({ ...rule, id: e.target.value })}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
                placeholder="ID (ex.: score_cert)"
              />
            </div>
          ) : (
            <input
              value={rule.id}
              onChange={(e) => onChange({ ...rule, id: e.target.value })}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="ID (ex.: ko_iso_9001)"
            />
          )}

          <input
            value={rule.message ?? ""}
            onChange={(e) => onChange({ ...rule, message: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Mensagem/explicação (ex.: Exige ISO 9001 vigente)"
          />
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-foreground/20"
          title="Excluir regra"
        >
          Remover
        </button>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
        <GroupEditor
          node={rule.when.type === "group" ? rule.when : { type: "group", _id: uuid(), op: "AND", children: [rule.when] }}
          catalog={catalog}
          onChange={(when) => onChange({ ...rule, when })}
          depth={0}
        />
      </div>
    </div>
  )
}

function GroupEditor({
  node,
  catalog,
  onChange,
  depth,
}: {
  node: Extract<Tree, { type: "group" }>
  catalog: FieldOption[]
  onChange: (n: Extract<Tree, { type: "group" }>) => void
  depth: number
}) {
  const addLine = () => {
    onChange({
      ...node,
      children: [
        ...node.children,
        { type: "condition", _id: uuid(), field: "capability", key: "certificacao.iso_9001", operator: "eq", value: true },
      ],
    })
  }

  const addGroup = () => {
    onChange({
      ...node,
      children: [...node.children, { type: "group", _id: uuid(), op: "AND", children: [] }],
    })
  }

  const updateChild = (childId: string, next: Tree) => {
    onChange({ ...node, children: node.children.map((c) => (c._id === childId ? next : c)) })
  }

  const deleteChild = (childId: string) => {
    onChange({ ...node, children: node.children.filter((c) => c._id !== childId) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={node.op}
            onChange={(e) => onChange({ ...node, op: e.target.value as any })}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
            title="Operador do grupo"
          >
            <option value="AND">E</option>
            <option value="OR">OU</option>
          </select>
          <div className="text-xs text-muted">Grupo {depth ? `(nível ${depth})` : ""}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-foreground/20"
          >
            + Adicionar linha
          </button>
          <button
            type="button"
            onClick={addGroup}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-foreground/20"
          >
            + Adicionar grupo
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {node.children.map((ch) =>
          ch.type === "group" ? (
            <div key={ch._id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => deleteChild(ch._id)}
                  className="text-xs text-muted underline"
                >
                  remover grupo
                </button>
              </div>
              <GroupEditor node={ch} catalog={catalog} onChange={(n) => updateChild(ch._id, n)} depth={depth + 1} />
            </div>
          ) : (
            <ConditionEditor
              key={ch._id}
              node={ch}
              catalog={catalog}
              onChange={(n) => updateChild(ch._id, n)}
              onDelete={() => deleteChild(ch._id)}
            />
          )
        )}
        {!node.children.length ? <div className="text-xs text-muted">Sem condições. Adicione uma linha.</div> : null}
      </div>
    </div>
  )
}

function ConditionEditor({
  node,
  catalog,
  onChange,
  onDelete,
}: {
  node: Extract<Tree, { type: "condition" }>
  catalog: FieldOption[]
  onChange: (n: Extract<Tree, { type: "condition" }>) => void
  onDelete: () => void
}) {
  const selected = catalog.find((c) => c.field === node.field && c.key === (node.key ?? "")) ?? catalog[0]
  const ops = operatorOptions(selected.valueType)

  const setField = (val: string) => {
    const [field, key] = val.split("::")
    const fo = catalog.find((c) => c.field === field && c.key === key) ?? selected
    const nextOp = operatorOptions(fo.valueType).find((o) => o.op === node.operator)?.op ?? "eq"
    let nextVal: any = node.value
    if (fo.valueType === "boolean") nextVal = true
    if (fo.valueType === "number") nextVal = 0
    if (fo.valueType === "enum") nextVal = "pregao"
    onChange({ ...node, field: fo.field, key: fo.key, operator: nextOp, value: nextVal })
  }

  const renderValue = () => {
    if (node.operator === "present" || node.operator === "absent") return <div className="text-xs text-muted">—</div>

    if (selected.valueType === "boolean") {
      return (
        <select
          value={String(Boolean(node.value))}
          onChange={(e) => onChange({ ...node, value: e.target.value === "true" })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      )
    }

    if (node.operator === "between") {
      const v = Array.isArray(node.value) ? node.value : [0, 0]
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={String(v[0] ?? "")}
            onChange={(e) => onChange({ ...node, value: [Number(e.target.value), Number(v[1] ?? 0)] })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="min"
            inputMode="numeric"
          />
          <input
            value={String(v[1] ?? "")}
            onChange={(e) => onChange({ ...node, value: [Number(v[0] ?? 0), Number(e.target.value)] })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="max"
            inputMode="numeric"
          />
        </div>
      )
    }

    if (node.operator === "in" || node.operator === "not_in") {
      const v = Array.isArray(node.value) ? node.value.join(",") : String(node.value ?? "")
      return (
        <input
          value={v}
          onChange={(e) =>
            onChange({
              ...node,
              value: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="val1, val2, val3"
        />
      )
    }

    if (selected.valueType === "number") {
      return (
        <input
          value={String(node.value ?? "")}
          onChange={(e) => onChange({ ...node, value: Number(e.target.value) })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          inputMode="numeric"
        />
      )
    }

    if (selected.valueType === "enum") {
      return (
        <select
          value={String(node.value ?? "")}
          onChange={(e) => onChange({ ...node, value: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="pregao">pregão</option>
          <option value="concorrencia">concorrência</option>
          <option value="dispensa">dispensa</option>
          <option value="desconhecido">desconhecido</option>
        </select>
      )
    }

    return (
      <input
        value={String(node.value ?? "")}
        onChange={(e) => onChange({ ...node, value: e.target.value })}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
      <div className="md:col-span-5">
        <div className="text-[11px] text-muted mb-1">Campo</div>
        <select
          value={`${node.field}::${node.key ?? ""}`}
          onChange={(e) => setField(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {catalog.map((c) => (
            <option key={`${c.field}:${c.key}`} value={`${c.field}::${c.key}`}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3">
        <div className="text-[11px] text-muted mb-1">Operador</div>
        <select
          value={node.operator}
          onChange={(e) => onChange({ ...node, operator: e.target.value as any })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {ops.map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3">
        <div className="text-[11px] text-muted mb-1">Valor</div>
        {renderValue()}
      </div>
      <div className="md:col-span-1 flex justify-end pt-5">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-border bg-background px-2 py-2 text-xs hover:border-foreground/20"
          title="Remover linha"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
