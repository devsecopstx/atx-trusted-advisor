/** Max characters persisted on `user_tasks.lastResultSnippet` / `user_task_runs.outputSnippet`. */
export const USER_TASK_STORED_OUTPUT_MAX_CHARS = 28_000;

/**
 * Strip citation chips and noisy markdown artifacts from automation / desk report text
 * before persisting or emailing user-task output.
 */
export function cleanUserTaskLlmOutput(text: string): string {
  let t = text.replace(/\r\n/g, "\n");
  // Inline XF_CITE chips (optional backticks)
  t = t.replace(/`?XF_CITE:\S+`?/gi, "");
  // Whole-line chip-only rows
  t = t.replace(/^\s*`?XF_CITE:[^\n`]*`?\s*$/gim, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

export function capUserTaskStoredOutput(text: string): string {
  if (text.length <= USER_TASK_STORED_OUTPUT_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, USER_TASK_STORED_OUTPUT_MAX_CHARS).trimEnd()}\n\n_(truncated for storage)_`;
}
