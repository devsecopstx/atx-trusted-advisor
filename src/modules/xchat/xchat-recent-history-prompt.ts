import type { XChatHistoryItem } from "@/modules/xchat/types";

const DEFAULT_MAX_CHARS = 6_000;
const DEFAULT_MAX_MESSAGES = 10;

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

export type XchatRecentThreadMessage = {
  role: "user" | "assistant";
  content: string;
};

/** `/v1/responses` turns routed to Grok 4.3 (persona or Expert/Heavy depth). */
export function isGrok43FamilyModelId(model: string | undefined | null): boolean {
  const m = typeof model === "string" ? model.trim().toLowerCase() : "";
  return m.includes("grok-4.3");
}

/** Platform override from `xchat_platform_settings.xchatGrok43MaxPriorThreadMessages` (clamped 4–6). */
export function clampGrok43MaxPriorThreadMessages(platformOverride: number | undefined): number {
  if (platformOverride === undefined || platformOverride === null) {
    return 5;
  }
  const n = Math.round(Number(platformOverride));
  if (!Number.isFinite(n)) {
    return 5;
  }
  return Math.min(6, Math.max(4, n));
}

/**
 * Compact digest of dropped turns for Grok 4.3 (deterministic; avoids an extra summarization model call).
 */
export function buildCondensedOlderThreadMessagesBlock(
  older: XchatRecentThreadMessage[],
  options?: { maxChars?: number }
): string | null {
  if (older.length === 0) {
    return null;
  }
  const maxChars = options?.maxChars ?? 2_800;
  const header = `Conversation summary (earlier thread turns, condensed — ${older.length} messages):`;
  const lines: string[] = [header];
  let used = header.length + 32;
  for (let i = 0; i < older.length; i += 1) {
    const row = older[i]!;
    const role = row.role === "assistant" ? "Assistant" : "User";
    const excerpt = truncateForPrompt(row.content, 320);
    const chunk = `- (${i + 1}) ${role}: ${excerpt}`;
    if (used + chunk.length > maxChars) {
      lines.push(`… (${older.length - i} older turns omitted from digest)`);
      break;
    }
    lines.push(chunk);
    used += chunk.length + 1;
  }
  return lines.join("\n");
}

/**
 * Prior-thread block for ask: full cap for non–Grok 4.3; Grok 4.3 uses 4–6 verbatim turns + condensed older digest.
 */
export function resolveRecentThreadMessagesPromptBlock(input: {
  messages: XchatRecentThreadMessage[];
  executionModel: string;
  grok43MaxPriorThreadMessages?: number | undefined;
}): string | null {
  const grok43 = isGrok43FamilyModelId(input.executionModel);
  const maxMessages = grok43
    ? clampGrok43MaxPriorThreadMessages(input.grok43MaxPriorThreadMessages)
    : DEFAULT_MAX_MESSAGES;
  const older =
    grok43 && input.messages.length > maxMessages
      ? input.messages.slice(0, input.messages.length - maxMessages)
      : [];
  const summaryBlock =
    older.length > 0 ? buildCondensedOlderThreadMessagesBlock(older, { maxChars: 3_000 }) : null;
  const recentBlock = buildRecentThreadMessagesPromptBlock(input.messages, {
    maxMessages,
    maxChars: grok43 ? 4_500 : DEFAULT_MAX_CHARS
  });
  if (!summaryBlock && !recentBlock) {
    return null;
  }
  return [summaryBlock, recentBlock].filter(Boolean).join("\n\n");
}

export function buildRecentThreadMessagesPromptBlock(
  messages: XchatRecentThreadMessage[],
  options?: { maxChars?: number; maxMessages?: number }
): string | null {
  if (messages.length === 0) {
    return null;
  }
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const capped = messages.slice(-maxMessages);
  const lines: string[] = [
    "Recent thread messages (same signed-in user and active conversation thread; preserve continuity):"
  ];
  let used = lines.join("\n").length + 32;
  for (let i = 0; i < capped.length; i += 1) {
    const row = capped[i]!;
    const role = row.role === "assistant" ? "Assistant" : "User";
    const content = truncateForPrompt(row.content, 1_600);
    const chunk = `${role}: ${content}`;
    if (used + chunk.length > maxChars) {
      lines.push("… (older thread context omitted to stay within context budget)");
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
