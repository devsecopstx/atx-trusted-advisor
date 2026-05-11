/**
 * Server-side routing helpers for POST /api/xchat/ask — multi-agent downgrade and NL → strategy job preflight.
 * Policy: atx-docs/xchat/context-routing-multi-agent-policy.md
 */

/** When true, persona multi-agent model may run with parallelism + optional reasoningEffort. */
export function heavySynthesisIntent(message: string): boolean {
  const m = message.trim();
  if (m.length > 2800) {
    return true;
  }
  const lower = m.toLowerCase();
  const patterns: RegExp[] = [
    /\bred team\b/,
    /\bmulti-?agent\b/,
    /\bparallel (agents|research)\b/,
    /\bsynthesize (all|every|multiple) (sources|perspectives)\b/,
    /\bcross-?source\b/,
    /\binvestment committee\b/,
    /\bexhaustive (research|analysis)\b/,
    /\bdeep (dive|research)\b.*\b(and|with|across)\b/,
    /\bcompare (the )?(bull|bear).*(bear|bull)\b/,
    /\bscenario analysis\b.*\band\b.*\band\b/
  ];
  return patterns.some((p) => p.test(lower));
}

/**
 * One-turn NL preflight: user clearly wants a structured multi-leg / xOptions-style workflow.
 * Keeps scope narrow to avoid hijacking generic “options” mentions.
 */
export function shouldOfferStrategyJobPreflight(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (m.length < 14 || m.length > 720) {
    return false;
  }
  const terms = [
    "covered call",
    "cash secured put",
    "cash-secured put",
    "iron condor",
    "credit spread",
    "debit spread",
    "put spread",
    "call spread",
    "straddle",
    "strangle",
    "collar ",
    "collar,",
    "wheel strategy",
    "the wheel",
    "csp ",
    "csp,",
    "csp?",
    "butterfly",
    "calendar spread",
    "diagonal spread",
    "multi-leg",
    "multileg",
    "multi leg",
    "options strategy",
    "build an options",
    "build a options",
    "xoptions"
  ];
  return terms.some((t) => m.includes(t));
}

/**
 * One-turn direct routing to deterministic options action scan (holdings + watchlist recommendations).
 * Keeps this narrow so generic options learning asks still use normal chat.
 */
export function shouldRunOptionsActionScan(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m) {
    return false;
  }
  if (m === "options_scan" || m === "/options_scan") {
    return true;
  }
  const patterns: RegExp[] = [
    /\bscan my options\b/,
    /\bcheck my options holdings\b/,
    /\boptions health check\b/,
    /\bscan options holdings\b/,
    /\boptions action scan\b/,
    /\bwhat should i do with my options\b/
  ];
  return patterns.some((pattern) => pattern.test(m));
}

function extractMongoObjectIdFromText(message: string): string | undefined {
  const match = message.match(/\b([a-f\d]{24})\b/i);
  return match?.[1]?.toLowerCase();
}

function messageRequestsWatchlistForPortfolio(normalized: string): boolean {
  if (!normalized.includes("watchlist")) {
    return false;
  }
  return (
    normalized.includes("watchlist for ") ||
    normalized.includes("show watchlist for ") ||
    normalized.includes("show my watchlist for ") ||
    normalized.includes("list my watchlist for ")
  );
}

/**
 * Direct deterministic watchlist asks should route to atx_function watchlist_snapshot.
 * Excludes mutating requests (add/remove/delete) that need normal tool-loop intent handling.
 */
export function isShowWatchlistIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (
    normalized.includes("add ") ||
    normalized.includes("remove ") ||
    normalized.includes("delete ") ||
    normalized.includes("watchlist add") ||
    normalized.includes("watchlist remove")
  ) {
    return false;
  }
  return (
    normalized === "show my watchlist" ||
    normalized === "my watchlist" ||
    normalized.includes("show watchlist") ||
    normalized.includes("show my watchlist") ||
    normalized.includes("list my watchlist") ||
    normalized.includes("what is in my watchlist")
  );
}

export type WatchlistPortfolioSlotCollectionResult = {
  needsPortfolioId: boolean;
  resolvedPortfolioId?: string;
};

/**
 * When true (with `hasXfinanceTool`), `/api/xchat/ask` eagerly runs `loadWorkspaceSnapshotPreload`
 * in parallel with RAG so first-turn `atx_function` calls (`portfolio_summary`, `watchlist_snapshot`,
 * `positions_snapshot`, `account_health`) short-circuit via `PRELOAD_SHORT_CIRCUIT_OPS` instead of
 * lazy Mongo + duplicate fetches.
 */
export function shouldEagerWorkspaceSnapshotPreloadForMessage(message: string): boolean {
  const m = message.trim().toLowerCase();
  if (!m) {
    return false;
  }
  if (
    /^(what is|what's|define|explain)\s+(a\s+|the\s+)?(covered[- ]call|covered call|wheel strategy|the wheel)\b/i.test(
      m
    )
  ) {
    return false;
  }
  if (
    m.includes("watchlist add") ||
    m.includes("watchlist remove") ||
    (m.includes(" add ") && m.includes("watchlist")) ||
    (m.includes(" remove ") && m.includes("watchlist"))
  ) {
    return false;
  }

  const holdingsPlusWatchlistPhrase =
    m.includes("from holdings") ||
    (m.includes("holdings") && m.includes("watchlist"));

  const bookCue =
    /\b(holdings?|watchlist|positions?|portfolio)\b/.test(m) ||
    /\bmy portfolio\b/.test(m);

  const wheelIdeasPhrase =
    /\bwheel\b.*\bideas?\b/.test(m) || /\bideas?\b.*\bwheel\b/.test(m);

  const incomeOrScanCue =
    /\bcovered[- ]calls?\b/.test(m) ||
    /\bcovered call\b/.test(m) ||
    /\bwheel strategy\b/.test(m) ||
    /\bthe wheel\b/.test(m) ||
    /\b(?:cash[- ]secured|csp)\b/.test(m) ||
    /\boptions?\s*(scan|action)\b/.test(m) ||
    /\bscan my options\b/.test(m);

  const ideasIncomeCue =
    /\bideas?\b/.test(m) &&
    (incomeOrScanCue || wheelIdeasPhrase || /\bcovered[- ]calls?\b/.test(m) || /\bcovered call\b/.test(m));

  return (
    holdingsPlusWatchlistPhrase ||
    (bookCue && incomeOrScanCue) ||
    wheelIdeasPhrase ||
    ideasIncomeCue
  );
}

/**
 * NL slot collection for direct watchlist asks:
 * - If user asks "show watchlist for [portfolio]" and includes a 24-char id, resolve it.
 * - If user asks "show watchlist for ..." without a resolvable id, require a follow-up slot prompt.
 */
export function collectWatchlistPortfolioIdSlot(input: {
  message: string;
  requestPortfolioId?: string;
}): WatchlistPortfolioSlotCollectionResult {
  const requestPortfolioId = input.requestPortfolioId?.trim();
  if (requestPortfolioId && /^[a-f\d]{24}$/i.test(requestPortfolioId)) {
    return { needsPortfolioId: false, resolvedPortfolioId: requestPortfolioId.toLowerCase() };
  }
  const normalized = input.message.trim().toLowerCase();
  if (!messageRequestsWatchlistForPortfolio(normalized)) {
    return { needsPortfolioId: false };
  }
  const extracted = extractMongoObjectIdFromText(input.message);
  if (extracted) {
    return { needsPortfolioId: false, resolvedPortfolioId: extracted };
  }
  return { needsPortfolioId: true };
}

/** Stored on the assistant turn for clients that render plain text; the chat UI uses a dedicated card layout instead. */
export const STRATEGY_JOB_PREFLIGHT_MARKDOWN = `### Structured options planning

You are asking for a **structured options-income workflow**. The product can collect desk context in a guided flow, produce a **written summary** (Markdown + JSON) for your records, and hand off to **xStrategyBuilder** when you are ready.

Reply **"launch strategy job"** (or **"yes"**) to start that workflow, or **"stay in chat"** to keep a high-level, educational conversation here without the formal package.

_Not investment advice. Options involve substantial risk; review suitability, liquidity, assignment risk, and tax impact before execution._`;
