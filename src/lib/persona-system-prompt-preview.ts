/** Admin list surfaces: show start of system prompt without loading full text in the row. */
export const PERSONA_SYSTEM_PROMPT_PREVIEW_MAX = 40;

export function personaSystemPromptPreview(raw: string | null | undefined): string {
  const trimmedStart = (raw ?? "").replace(/^\s+/, "");
  if (trimmedStart.length <= PERSONA_SYSTEM_PROMPT_PREVIEW_MAX) {
    return trimmedStart;
  }
  return `${trimmedStart.slice(0, PERSONA_SYSTEM_PROMPT_PREVIEW_MAX)}…`;
}
