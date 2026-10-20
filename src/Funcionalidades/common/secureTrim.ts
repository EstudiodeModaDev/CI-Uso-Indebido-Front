export function secureTrim(s: unknown): string{
  if(s === null || s === undefined) return ""

  return String(s).trim()
}
