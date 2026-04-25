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

/** Stored on the assistant turn for clients that render plain text; the chat UI uses a dedicated card layout instead. */
export const STRATEGY_JOB_PREFLIGHT_MARKDOWN = `### Structured options planning

You are asking for a **structured options-income workflow**. The product can collect desk context in a guided flow, produce a **written summary** (Markdown + JSON) for your records, and hand off to **xStrategyBuilder** when you are ready.

Reply **"launch strategy job"** (or **"yes"**) to start that workflow, or **"stay in chat"** to keep a high-level, educational conversation here without the formal package.

_Not investment advice. Options involve substantial risk; review suitability, liquidity, assignment risk, and tax impact before execution._`;
