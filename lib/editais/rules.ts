export type RuleTree = RuleGroup | RuleCondition | RuleRuleRef;

export type RuleGroup = {
  type: "group";
  op: "AND" | "OR";
  children: RuleTree[];
};

export type RuleCondition = {
  type: "condition";
  field:
    | "capability" // company_capabilities[<key>]
    | "requirement" // requirements contains key
    | "classification" // edital_classifications.data[<key>]
    | "edital" // campos do edital (deadline_at, urgency_score, etc.)
    | "extraction"; // (confidence)
  key?: string; // para capability/requirement/classification/edital/extraction
  operator:
    | "present"
    | "absent"
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "in"
    | "not_in"
    | "between";
  value?: any;
};

export type RuleRuleRef = {
  type: "rule";
  ruleType: "KO" | "SCORE" | "INFO";
  id: string;
  title: string;
  weight?: number; // para SCORE
  when: RuleTree;
  message?: string;
};

export type EvalInput = {
  capabilities: Record<string, any>;
  requirements: Array<{ key: string; required?: boolean; [k: string]: any }>;
  extraction: { confidence: number };
  classification: Record<string, any>;
  edital: { deadline_at?: string | null; urgency_score?: number | null; [k: string]: any };
};

export type EvalResult = {
  verdict: "APTO" | "INAPTO" | "APTO_COM_RESSALVAS" | "REVISAO_HUMANA";
  score: number;
  gaps: Array<{ ruleId?: string; key?: string; description: string }>;
  recommendations: Array<{ type: string; message: string }>;
  audit: any;
};

function requirementPresent(reqs: EvalInput["requirements"], key: string) {
  return reqs.some((r) => r.key === key);
}

function getCapability(cap: EvalInput["capabilities"], key: string) {
  return cap[key];
}

function evalCondition(c: RuleCondition, input: EvalInput): boolean {
  const op = c.operator;
  const key = c.key ?? "";

  const cmpNumber = (v: any, x: any) => {
    const vn = Number(v);
    const xn = Number(x);
    if (Number.isNaN(vn) || Number.isNaN(xn)) return false;
    if (op === "gt") return vn > xn;
    if (op === "gte") return vn >= xn;
    if (op === "lt") return vn < xn;
    if (op === "lte") return vn <= xn;
    if (op === "eq") return vn === xn;
    if (op === "neq") return vn !== xn;
    return false;
  };

  const cmpString = (v: any, x: any) => {
    const a = String(v ?? "");
    const b = String(x ?? "");
    if (op === "contains") return a.toLowerCase().includes(b.toLowerCase());
    if (op === "eq") return a === b;
    if (op === "neq") return a !== b;
    return false;
  };

  const cmpIn = (v: any, x: any, negate: boolean) => {
    if (!Array.isArray(x)) return false;
    const found = x.some((it) => it === v);
    return negate ? !found : found;
  };

  const cmpBetween = (v: any, x: any) => {
    if (!Array.isArray(x) || x.length !== 2) return false;
    const [min, max] = x;
    const vn = Number(v);
    const a = Number(min);
    const b = Number(max);
    if ([vn, a, b].some((n) => Number.isNaN(n))) return false;
    return vn >= a && vn <= b;
  };

  if (c.field === "requirement") {
    if (!key) return false;
    const present = requirementPresent(input.requirements, key);
    if (op === "present") return present;
    if (op === "absent") return !present;
    // operadores com value não fazem muito sentido aqui por enquanto
    return false;
  }

  if (c.field === "capability") {
    if (!key) return false;
    const v = getCapability(input.capabilities, key);
    if (op === "present") return v !== undefined && v !== null;
    if (op === "absent") return v === undefined || v === null;
    if (op === "in") return cmpIn(v, c.value, false);
    if (op === "not_in") return cmpIn(v, c.value, true);
    if (typeof v === "number") return cmpNumber(v, c.value);
    if (typeof v === "boolean") {
      if (op === "eq") return v === Boolean(c.value);
      if (op === "neq") return v !== Boolean(c.value);
      return false;
    }
    return cmpString(v, c.value);
  }

  if (c.field === "classification") {
    if (!key) return false;
    const v = input.classification?.[key];
    if (op === "present") return v !== undefined && v !== null && v !== "";
    if (op === "absent") return v === undefined || v === null || v === "";
    if (op === "in") return cmpIn(v, c.value, false);
    if (op === "not_in") return cmpIn(v, c.value, true);
    if (typeof v === "number") return cmpNumber(v, c.value);
    return cmpString(v, c.value);
  }

  if (c.field === "edital") {
    if (!key) return false;
    const v = input.edital?.[key];
    if (key === "deadline_at") {
      const d = v ? new Date(String(v)) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      // para deadline_at, operadores numéricos comparam "dias até o prazo"
      if (op === "between") return cmpBetween(days, c.value);
      if (op === "in") return cmpIn(days, c.value, false);
      if (op === "not_in") return cmpIn(days, c.value, true);
      return cmpNumber(days, c.value);
    }
    if (op === "present") return v !== undefined && v !== null && v !== "";
    if (op === "absent") return v === undefined || v === null || v === "";
    if (op === "between") return cmpBetween(v, c.value);
    if (op === "in") return cmpIn(v, c.value, false);
    if (op === "not_in") return cmpIn(v, c.value, true);
    if (typeof v === "number") return cmpNumber(v, c.value);
    return cmpString(v, c.value);
  }

  if (c.field === "extraction") {
    const k = key || "confidence";
    const v = (input.extraction as any)?.[k];
    if (op === "present") return v !== undefined && v !== null;
    if (op === "absent") return v === undefined || v === null;
    if (op === "between") return cmpBetween(v, c.value);
    if (op === "in") return cmpIn(v, c.value, false);
    if (op === "not_in") return cmpIn(v, c.value, true);
    return cmpNumber(v, c.value);
  }

  return false;
}

function evalTree(tree: RuleTree, input: EvalInput): boolean {
  if (tree.type === "condition") return evalCondition(tree, input);
  if (tree.type === "group") {
    if (tree.op === "AND") return tree.children.every((ch) => evalTree(ch, input));
    return tree.children.some((ch) => evalTree(ch, input));
  }
  // "rule" não é avaliado diretamente aqui; é avaliado no executor de regra-set
  return false;
}

export function evaluateRuleSetTree(tree: any, input: EvalInput): EvalResult {
  const rules: RuleRuleRef[] = Array.isArray(tree?.rules) ? tree.rules : [];

  let score = 0;
  const gaps: EvalResult["gaps"] = [];
  const recommendations: EvalResult["recommendations"] = [];

  let hasKOFail = false;
  let hasWarn = false;

  const audit: any = { rules: [] as any[] };

  for (const r of rules) {
    const ok = evalTree(r.when, input);
    audit.rules.push({ id: r.id, type: r.ruleType, ok });

    if (r.ruleType === "KO") {
      if (!ok) {
        hasKOFail = true;
        gaps.push({ ruleId: r.id, description: r.message ?? `Falha eliminatória: ${r.title}` });
      }
    } else if (r.ruleType === "SCORE") {
      if (ok) score += Number(r.weight ?? 0);
    } else if (r.ruleType === "INFO") {
      if (!ok) {
        hasWarn = true;
        recommendations.push({ type: "info", message: r.message ?? `Atenção: ${r.title}` });
      }
    }
  }

  let verdict: EvalResult["verdict"] = "REVISAO_HUMANA";

  // Se extração muito baixa, força revisão humana
  if ((input.extraction?.confidence ?? 0) < 0.35) {
    verdict = "REVISAO_HUMANA";
    recommendations.push({ type: "review", message: "Confiança da extração baixa; revisar manualmente." });
  } else if (hasKOFail) {
    verdict = "INAPTO";
  } else {
    verdict = hasWarn ? "APTO_COM_RESSALVAS" : "APTO";
  }

  return { verdict, score, gaps, recommendations, audit };
}
