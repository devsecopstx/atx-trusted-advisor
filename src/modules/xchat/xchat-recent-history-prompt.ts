import type { XChatHistoryItem } from "@/modules/xchat/types";

const DEFAULT_MAX_CHARS = 6_000;

/**
 * Formats prior Mongo `xchat_logs` turns (same user + tenant) for the ask system prompt.
 * Newest history items should be passed first; output is chronological for readability.
 */
export function buildRecentXchatHistoryPromptBlock(
  itemsNewestFirst: XChatHistoryItem[],
  maxChars: number = DEFAULT_MAX_CHARS
): string | null {
  if (itemsNewestFirst.length === 0) {
    return null;
  }
  const chronological = [...itemsNewestFirst].reverse();
  const lines: string[] = [
    "Prior xChat turns (same signed-in user and workspace tenant; use for continuity — do not recite verbatim unless the user asks):"
  ];
  let used = lines.join("\n").length + 32;

  for (let i = 0; i < chronological.length; i += 1) {
    const it = chronological[i]!;
    const u = truncateForPrompt(it.message, 1_200);
    const a = truncateForPrompt(it.response, 1_800);
    const chunk = [
      `--- Turn ${i + 1} (${it.createdAt.toISOString()}) ---`,
      `User: ${u}`,
      `Assistant: ${a}`
    ].join("\n");
    if (used + chunk.length > maxChars) {
      lines.push("… (earlier turns omitted to stay within context budget)");
      break;
    }
    lines.push(chunk);
    used += chunk.length + 1;
  }

  return lines.join("\n\n");
}

function truncateForPrompt(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max)}…`;
}
