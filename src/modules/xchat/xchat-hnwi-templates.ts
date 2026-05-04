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
export const XCHAT_HNWI_PROMPT_TEMPLATES: readonly XchatPromptTemplate[] = [
  {
    id: "portfolio-concentration",
    title: "Portfolio concentration review",
    subtitle: "Workspace · risk framing",
    prompt:
      "Review my portfolio for concentration risk: largest positions by notional, sector/style skew, and one actionable idea to diversify or hedge without predicting markets. Use my workspace holdings if available."
  },
  {
    id: "wheel-income",
    title: "Wheel / covered-call scan",
    subtitle: "Income · defined risk",
    prompt:
      "Given my current holdings and watchlist, suggest up to three covered-call or wheel-style income ideas with strike/expiry rationale and what assignment would mean. Educational only — not a recommendation to trade."
  },
  {
    id: "protective-puts",
    title: "Protective put checklist",
    subtitle: "Downside · hedges",
    prompt:
      "Walk through a protective put framework for my largest equity line items: how to think about tenor, strike vs cost, and rolling — tied to my workspace positions if you see them."
  },
  {
    id: "watchlist-update",
    title: "Watchlist priority pass",
    subtitle: "Desk · names to watch",
    prompt:
      "Summarize my watchlist as I have it in workspace: themes, overlap with holdings, and the top three names worth a deeper options-structure pass this week."
  },
  {
    id: "macro-regime",
    title: "Macro regime briefing",
    subtitle: "Tape · volatility lens",
    prompt:
      "Give a concise macro-and-volatility briefing for an options-focused book: rates, credit, broad indices, and how you'd stress a balanced equity/options sleeve — educational framing only."
  },
  {
    id: "family-governance",
    title: "Family office talking points",
    subtitle: "HNWI · communication",
    prompt:
      "Draft short talking points I can use with family principals: portfolio snapshot themes, risk disclosures in plain language, and three questions they should ask their advisor — not legal or tax advice."
  },
  {
    id: "compliance-framing",
    title: "Compliance-aware explanation",
    subtitle: "Education · guardrails",
    prompt:
      "Explain how to discuss options strategies with clients using compliant, educational language: no guarantees, suitability reminders, and how to separate facts from opinion."
  },
  {
    id: "scenarios",
    title: "Scenario stress sketch",
    subtitle: "What-if · planning",
    prompt:
      "Run two quick scenarios on my workspace book: a -10% broad equity shock and a vol spike. Describe directional impacts on a typical options-heavy sleeve and what to monitor — illustrative only."
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
