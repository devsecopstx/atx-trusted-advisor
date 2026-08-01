/**
 * Approximate USD for xChat admin analytics. Rates align with public xAI model + tools pricing
 * (subject to change — verify in console).
 *
 * @see https://docs.x.ai/docs/models — Models and Pricing (per 1M tokens)
 * @see https://docs.x.ai/docs/models#tool-invocation-costs — tool $ / 1k invocations
 */

export type TokenRatesPerMillionUsd = {
  /** Non-cached input (USD per 1M tokens). */
  inputPerMillion: number;
  /** Output + reasoning treated as output-priced (USD per 1M tokens). */
  outputPerMillion: number;
  /** Cached input discount (USD per 1M cached prompt tokens) when reported. */
  cachedInputPerMillion?: number;
};

/** grok-4-1-fast-* from docs: $0.20 in / $0.50 out (per 1M). */
const RATE_FAST: TokenRatesPerMillionUsd = { inputPerMillion: 0.2, outputPerMillion: 0.5, cachedInputPerMillion: 0.05 };

/** grok-4.3 flagship row from docs (approximate — verify in console). */
const RATE_GROK_43: TokenRatesPerMillionUsd = { inputPerMillion: 1.25, outputPerMillion: 2.5 };

/** grok-4.5 / grok-4.20* / multi-agent from docs: $2 in / $6 out (per 1M; cached $0.30 on 4.5). */
const RATE_420: TokenRatesPerMillionUsd = { inputPerMillion: 2, outputPerMillion: 6, cachedInputPerMillion: 0.2 };

export function resolveXaiModelTokenRates(model: string): TokenRatesPerMillionUsd | null {
  const m = model.trim().toLowerCase();
  if (!m) {
    return null;
  }
  if (m.includes("multi-agent")) {
    return RATE_420;
  }
  if (m.includes("grok-4.20") || m.includes("grok-4-20") || m.includes("grok-4_20")) {
    return RATE_420;
  }
  if (m.includes("grok-4.5") || m.includes("grok-build")) {
    return { ...RATE_420, cachedInputPerMillion: 0.3 };
  }
  if (m.includes("grok-4.3")) {
    return RATE_GROK_43;
  }
  if (m.includes("grok-4-1-fast") || m.includes("grok-4-1_fast") || m.includes("grok-4.1-fast")) {
    return RATE_FAST;
  }
  if (m.includes("grok-4-latest") || m === "grok-4" || m.startsWith("grok-4-")) {
    return RATE_FAST;
  }
  if (m.includes("grok-3")) {
    return RATE_FAST;
  }
  return null;
}

export function estimateUsdFromTokenUsage(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedPromptTokens: number;
}): { usd: number; pricingKey: string } | null {
  const rates = resolveXaiModelTokenRates(input.model);
  if (!rates) {
    return null;
  }
  const m = input.model.trim().toLowerCase();
  const key =
    m.includes("grok-4.5") || m.includes("grok-build")
      ? "grok-4.5-class"
      : rates === RATE_420
        ? "grok-4.20-class"
        : rates === RATE_GROK_43
          ? "grok-4.3-class"
          : rates === RATE_FAST
            ? "grok-4-1-fast-class"
            : "custom";
  const inCost = (input.inputTokens / 1_000_000) * rates.inputPerMillion;
  const outBillable = input.outputTokens + input.reasoningTokens;
  const outCost = (outBillable / 1_000_000) * rates.outputPerMillion;
  const cachedRate = rates.cachedInputPerMillion ?? rates.inputPerMillion * 0.25;
  const cachedCost =
    input.cachedPromptTokens > 0 ? (input.cachedPromptTokens / 1_000_000) * cachedRate : 0;
  return { usd: inCost + outCost + cachedCost, pricingKey: key };
}

/** USD per invocation (docs: $X per 1k calls → divide by 1000). */
const HOSTED_TOOL_USD_PER_CALL: Record<string, number> = {
  web_search: 5 / 1000,
  x_search: 5 / 1000,
  code_execution: 5 / 1000,
  code_interpreter: 5 / 1000,
  attachment_search: 10 / 1000,
  collections_search: 2.5 / 1000,
  file_search: 2.5 / 1000
};

export function estimateHostedToolUsd(toolName: string, callCount: number): number {
  const rate = HOSTED_TOOL_USD_PER_CALL[toolName];
  if (rate == null || callCount <= 0) {
    return 0;
  }
  return rate * callCount;
}
