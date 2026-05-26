import { canonicalMongoObjectIdHex, isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";

import type { StrategyChoiceId } from "@/app/xoptions/xoptions-strategy-choice-panels";

import type { XoptionsBuilderDeskDeepLinkStep } from "@/lib/xoptions/xoptions-builder-url";

/** Matches xOptions strategy builder input validation (underlyings). */
const UNDERLYING_RE = /^[A-Z0-9.\-]{1,10}$/;

export function isValidXoptionsUnderlyingSymbol(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  return UNDERLYING_RE.test(s);
}

export function normalizeXoptionsUnderlyingSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Open the strategy builder on `/xoptions` with optional desk scope + symbol.
 * `portfolioId` must be 24-char hex when present (workspace cookie sync on xOptions load).
 */
export type XoptionsStrategyBuilderDeskLinkOptions = {
  step?: XoptionsBuilderDeskDeepLinkStep;
  strategyChoiceId?: StrategyChoiceId | null;
  contractPrefill?: {
    expirationYmd: string;
    strike: number;
    contractType: "call" | "put";
  };
};

export function buildXoptionsStrategyBuilderHref(
  portfolioId: string | null | undefined,
  symbol: string,
  options?: XoptionsStrategyBuilderDeskLinkOptions
): string {
  const s = normalizeXoptionsUnderlyingSymbol(symbol);
  if (!isValidXoptionsUnderlyingSymbol(s)) {
    return "/xoptions";
  }
  const q = new URLSearchParams({ symbol: s });
  const pid = portfolioId?.trim() ?? "";
  if (pid && isLikelyMongoObjectIdHex(pid)) {
    q.set("portfolioId", canonicalMongoObjectIdHex(pid));
  }
  if (options?.step != null) {
    q.set("step", String(options.step));
  }
  if (options?.strategyChoiceId) {
    q.set("strategy", options.strategyChoiceId);
  }
  const prefill = options?.contractPrefill;
  if (prefill) {
    const exp = prefill.expirationYmd.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
      q.set("expiration", exp);
    }
    if (Number.isFinite(prefill.strike) && prefill.strike > 0) {
      q.set("strike", prefill.strike.toFixed(2));
      q.set("contractType", prefill.contractType);
    }
  }
  return `/xoptions?${q.toString()}`;
}
