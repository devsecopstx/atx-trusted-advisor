/**
 * Parse `usage` from xAI `/v1/responses` JSON (OpenAI-compatible fields + reasoning).
 * @see https://docs.x.ai/docs/models — Models and Pricing
 */

import type { XChatXaiUsageSnapshot } from "@/modules/xchat/types";

export type { XChatXaiUsageSnapshot };

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Best-effort extraction from a single Responses API response object (last turn payload is typical). */
export function extractXaiResponsesUsage(raw: unknown): XChatXaiUsageSnapshot | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const root = raw as Record<string, unknown>;
  const usage = root.usage;
  if (!usage || typeof usage !== "object") {
    return undefined;
  }
  const u = usage as Record<string, unknown>;
  const inputTokens = num(u.prompt_tokens ?? u.input_tokens);
  const outputTokens = num(u.completion_tokens ?? u.output_tokens);
  const reasoningTokens = num(u.reasoning_tokens);
  const cachedPromptTokens = num(u.cached_prompt_tokens ?? u.cache_read_input_tokens);
  /** xAI vendor-reported spend (integer ticks; semantics match console billing — store raw). */
  const costUsdTicks = num(
    (u as { cost_in_usd_ticks?: unknown }).cost_in_usd_ticks ??
      (u as { costInUsdTicks?: unknown }).costInUsdTicks
  );
  let totalTokens = num(u.total_tokens);
  if (totalTokens === 0) {
    totalTokens = inputTokens + outputTokens + reasoningTokens;
  }
  if (
    inputTokens === 0 &&
    outputTokens === 0 &&
    reasoningTokens === 0 &&
    totalTokens === 0 &&
    cachedPromptTokens === 0 &&
    costUsdTicks === 0
  ) {
    return undefined;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    ...(reasoningTokens > 0 ? { reasoningTokens } : {}),
    ...(cachedPromptTokens > 0 ? { cachedPromptTokens } : {}),
    ...(costUsdTicks > 0 ? { costUsdTicks } : {})
  };
}
