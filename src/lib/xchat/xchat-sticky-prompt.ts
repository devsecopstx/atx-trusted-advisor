export function isMultilineStickyPrompt(text: string): boolean {
  return /\r?\n/.test(text);
}

/** Collapse Latest prompt chrome for multiline prompts and while the advisor is working. */
export function isStickyPromptCollapsible(input: { multiline: boolean; loading: boolean }): boolean {
  return input.multiline || input.loading;
}

/** First non-empty line for collapsed Latest prompt chrome. */
export function stickyPromptHeadLine(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "[Empty prompt]";
  }
  for (const line of trimmed.split(/\r?\n/)) {
    const head = line.trim();
    if (head.length > 0) {
      return head;
    }
  }
  return trimmed;
}
