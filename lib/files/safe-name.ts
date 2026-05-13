export function safeStorageFileName(original: string): string {
  const base = (original || "file")
    .normalize("NFD")
    // remove diacritics
    .replace(/[\u0300-\u036f]/g, "")
    // replace whitespace with underscore
    .replace(/\s+/g, "_")
    // keep only safe characters
    .replace(/[^a-zA-Z0-9._-]/g, "")

  const trimmed = base.replace(/_+/g, "_").replace(/^[-_.]+|[-_.]+$/g, "")
  return trimmed.length ? trimmed.slice(-120) : "file"
}
