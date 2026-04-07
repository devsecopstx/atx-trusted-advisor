/** Narrow left-rail select: keep closed state readable without clipping. */
export function compactPersonaOptionLabel(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  const max = 22;
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}
