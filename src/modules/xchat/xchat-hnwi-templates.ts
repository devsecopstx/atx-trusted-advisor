export type XchatPromptTemplate = {
  id: string;
  /** Short card title (Grok-style template name). */
  title: string;
  /** Secondary line on card (e.g. workspace theme). */
  subtitle: string;
  /** Full prompt inserted into the composer. */
  prompt: string;
};

/**
 * Curated HNWI / RIA-style prompts for xChat templates strip (Grok-style gallery).
 * User-authored templates persist in Mongo (`xchat_user_prompt_templates`) via **`/api/app-user/xchat/prompt-templates`**.
 */

/** Canonical Wheel / CC scan composer text (built-in card + legacy saved-template upgrade). */
export const XCHAT_WHEEL_CC_SCAN_PROMPT =
  "From holdings + watchlist: up to three covered_call, wheel, or cash_secured_put ideas with strike, expiry, premium, contract sizing, annualized ROC, and assignment risk — answer as a formatted markdown desk report (headings and/or a table), using the desk field contract for each idea (not raw JSON only).";

/** Saved templates may still store the pre–3.19.5 JSON-only line; normalize on apply so the composer matches the built-in. */
export function resolveWheelCcScanComposerPrompt(prompt: string): string {
  const lower = prompt.trim().toLowerCase();
  if (!lower.includes("from holdings + watchlist")) {
    return prompt;
  }
  const hasCcOrSlug =
    /\bcovered_call\b/.test(lower) || /\bcovered[-_ ]calls?\b/.test(lower) || /\bcovered call\b/.test(lower);
  const hasWheel = /\bwheel\b/.test(lower);
  const hasCsp =
    /\bcash_secured_put\b/.test(lower) || /\bcash[-_ ]secured[-_ ]puts?\b/.test(lower);
  if (!hasWheel || !(hasCcOrSlug || hasCsp)) {
    return prompt;
  }
  if (!lower.includes("desk json contract only")) {
    return prompt;
  }
  return XCHAT_WHEEL_CC_SCAN_PROMPT;
}

export const XCHAT_HNWI_PROMPT_TEMPLATES: readonly XchatPromptTemplate[] = [
  {
    id: "portfolio-concentration",
    title: "Concentration review",
    subtitle: "Risk · workspace",
    prompt:
      "Review concentration: top notionals, sector skew, one diversify or hedge idea. Use workspace holdings if visible."
  },
  {
    id: "wheel-income",
    title: "Wheel / CC scan",
    subtitle: "Income · defined risk",
    prompt: XCHAT_WHEEL_CC_SCAN_PROMPT
  },
  {
    id: "protective-puts",
    title: "Protective puts",
    subtitle: "Downside hedges",
    prompt:
      "Protective put checklist for largest equity lines: tenor, strike vs cost, rolling — use workspace positions when visible."
  },
  {
    id: "watchlist-update",
    title: "Watchlist pass",
    subtitle: "Desk focus",
    prompt:
      "Summarize workspace watchlist: themes, overlap with holdings, top three names for an options pass this week."
  }
];

export function filterXchatPromptTemplates<T extends XchatPromptTemplate>(
  templates: readonly T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...templates];
  }
  return templates.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.subtitle.toLowerCase().includes(q) ||
      t.prompt.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
  );
}
