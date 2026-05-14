import type { XchatRecentThreadMessage } from "@/modules/xchat/xchat-recent-history-prompt";

/**
 * Max **conversation turns** (user+assistant pairs) injected into the Responses `input` array for long-term
 * memory. Product cap **4 turns** (~8 messages) so multi-turn portfolio reviews do not re-ship deep thread
 * context regardless of UI “keep last 10” persistence.
 */
export const XCHAT_ASK_MAX_TOOL_HISTORY_TURNS = 4;

/** @deprecated Use {@link XCHAT_ASK_MAX_TOOL_HISTORY_TURNS} */
export const XCHAT_LONG_TERM_MAX_TOOL_HISTORY_TURNS = XCHAT_ASK_MAX_TOOL_HISTORY_TURNS;

/** Rough character budget (~8k tokens) for long-term history injected into the Responses tool loop. */
export const XCHAT_LONG_TERM_HISTORY_MAX_CHARS = 24_000;

export type XchatResponsesHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

function truncateHistoryContent(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}

/**
 * Multi-turn Responses `input` for long-term memory: prior user/assistant turns plus the current user turn.
 * Capped at {@link XCHAT_ASK_MAX_TOOL_HISTORY_TURNS} turns and {@link XCHAT_LONG_TERM_HISTORY_MAX_CHARS}.
 */
export function buildFullHistoryMessages(
  recentMessages: XchatRecentThreadMessage[],
  currentMessage: string,
  options?: { maxTurns?: number; maxChars?: number }
): XchatResponsesHistoryMessage[] {
  const maxTurns = options?.maxTurns ?? XCHAT_ASK_MAX_TOOL_HISTORY_TURNS;
  const maxChars = options?.maxChars ?? XCHAT_LONG_TERM_HISTORY_MAX_CHARS;
  const maxMessages = maxTurns * 2;
  const rows = recentMessages
    .filter((row) => row.content.trim().length > 0)
    .slice(-maxMessages)
    .map((row) => ({
      role: row.role,
      content: truncateHistoryContent(row.content, 1_600)
    }));
  const messages: XchatResponsesHistoryMessage[] = [
    ...rows,
    { role: "user", content: currentMessage.trim() }
  ];

  let total = messages.reduce((sum, row) => sum + row.content.length, 0);
  while (messages.length > 1 && total > maxChars) {
    const removed = messages.shift();
    if (!removed) {
      break;
    }
    total -= removed.content.length;
  }

  return messages;
}

/** Ephemeral ask path: current user turn only (prior turns stay in the system prompt block). */
export function buildInputWithHistory(
  _recentMessages: XchatRecentThreadMessage[],
  currentMessage: string
): string {
  return currentMessage.trim();
}

export function resolveToolLoopConversationInput(input: {
  hasVisionImages: boolean;
  useRemoteContinuation: boolean;
  enableLongTermXaiMemory: boolean;
  recentMessages: XchatRecentThreadMessage[];
  userPrompt: string;
  captionForPrompt: string;
}): unknown | undefined {
  if (input.hasVisionImages) {
    return undefined;
  }
  if (input.useRemoteContinuation) {
    return buildInputWithHistory([], input.userPrompt);
  }
  if (input.enableLongTermXaiMemory) {
    const messages = buildFullHistoryMessages(input.recentMessages, input.captionForPrompt, {
      maxTurns: XCHAT_ASK_MAX_TOOL_HISTORY_TURNS
    });
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      last.content = input.userPrompt;
    }
    return messages;
  }
  return buildInputWithHistory(input.recentMessages, input.userPrompt);
}
