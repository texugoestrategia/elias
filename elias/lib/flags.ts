export function directoryModeEnabled() {
  // Chave de ativação (não ativa por padrão).
  // Coloque NEXT_PUBLIC_DIRECTORY_MODE=1 quando quiser migrar para o modelo pronto para AD.
  return process.env.NEXT_PUBLIC_DIRECTORY_MODE === "1"
}

