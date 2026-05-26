import type { StrategyChoiceId } from "@/app/xoptions/xoptions-strategy-choice-panels";

const STRATEGY_CHOICE_IDS: StrategyChoiceId[] = [
  "long-call",
  "covered-call",
  "cash-secured-put",
  "buy-write",
  "long-call-spread",
  "short-put-spread",
  "wheel-protective-collar"
];

/** Hot Picks / strategy engine slugs → xOptions builder card ids. */
const SCANNER_STRATEGY_SLUG_TO_CHOICE: Record<string, StrategyChoiceId> = {
  covered_call: "covered-call",
  cash_secured_put: "cash-secured-put",
  bull_put_spread: "short-put-spread",
  wheel_protective_collar: "wheel-protective-collar",
  long_call: "long-call",
  long_call_spread: "long-call-spread",
  buy_write: "buy-write"
};

export function isStrategyChoiceId(raw: string): raw is StrategyChoiceId {
  return (STRATEGY_CHOICE_IDS as string[]).includes(raw);
}

export function mapScannerStrategySlugToChoiceId(slug: string): StrategyChoiceId | null {
  const key = slug.trim().toLowerCase();
  if (!key) {
    return null;
  }
  return SCANNER_STRATEGY_SLUG_TO_CHOICE[key] ?? null;
}

/** `strategy` query: builder id (`covered-call`) or scanner slug (`covered_call`). */
export function parseStrategyChoiceIdFromUrlParam(raw: string | null | undefined): StrategyChoiceId | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  if (isStrategyChoiceId(t)) {
    return t;
  }
  return mapScannerStrategySlugToChoiceId(t.replace(/-/g, "_"));
}
