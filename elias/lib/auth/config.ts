export const ROLE_MAP: Record<string, "admin" | "gestor" | "analista" | "leitor"> = {
  "mimir-admin": "admin",
  "mimir-gestor": "gestor",
  "mimir-analista": "analista",
}

export function mapGroupsToRole(groups: string[] | undefined | null) {
  if (!groups?.length) return "leitor" as const
  for (const group of groups) {
    const role = ROLE_MAP[group]
    if (role) return role
  }
  return "leitor" as const
}

