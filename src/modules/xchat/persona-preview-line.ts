const PREVIEW_MAX = 140;

/**
 * Single-line preview for persona picker (from published persona system prompt).
 * Avoids leaking huge prompts into the UI.
 */
export function personaPreviewLineFromSystemPrompt(systemPrompt?: string | null): string | undefined {
  if (typeof systemPrompt !== "string") {
    return undefined;
  }
  const line = systemPrompt
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!line) {
    return undefined;
  }
  const collapsed = line.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_MAX) {
    return collapsed;
  }
  return `${collapsed.slice(0, PREVIEW_MAX - 1)}…`;
}
