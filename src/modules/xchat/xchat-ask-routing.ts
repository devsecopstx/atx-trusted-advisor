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

export const STRATEGY_JOB_PREFLIGHT_MARKDOWN = `### Guided strategy job

You are asking for a **structured options workflow**. Use the **xOptions orchestrator** (Spring \`/api/strategy-jobs\` behind the BFF) to collect desk context and produce an auditable **Markdown + JSON** artifact after slots complete.

**Next step:** open **[xOptions — guided strategy job](/xoptions?strategyJob=1)** and answer the short prompts. The page polls for the artifact while the finalizer runs.

If you only wanted a quick opinion **in chat**, reply **stay in chat** and ask again — we will keep the conversation here.`;
