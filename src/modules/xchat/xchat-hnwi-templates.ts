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
    title: "Concentration review",
    subtitle: "Risk · workspace",
    prompt:
      "Review concentration: top notionals, sector skew, one diversify or hedge idea. Use workspace holdings if visible."
  },
  {
    id: "wheel-income",
    title: "Wheel / CC scan",
    subtitle: "Income · defined risk",
    prompt:
      "From holdings + watchlist: up to three covered-call or wheel ideas with strike/expiry notes and assignment context."
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
