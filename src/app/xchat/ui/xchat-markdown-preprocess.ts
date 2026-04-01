/**
 * Light cleanup before ReactMarkdown — Grok/xAI output quirks and denser market summaries.
 *
 * Citations: stable `[@citation:slug]` / `[@citation:slug|Label]` → inline-code sentinels rendered as chips
 * in {@link XchatMarkdownBody}. Legacy `<grok:render type="render_inline_citation">…</grok:render>` maps to the
 * same pipeline (see `src/lib/xchat-citations.ts`).
 */

import {
    applyLeakedMarkupRules,
    collapseAdjacentDuplicateBareXfLines,
    collapseAdjacentDuplicateWrappedXfChipLines,
    dedupeInlineRepeatedBareXfSentinels,
    expandBracketCitationsToInlineCode,
    grokRenderBlocksToCitationMarkdown,
    grokRenderSelfClosingToCitationMarkdown,
    stripNonRenderableBareCitationLines,
    stripNonRenderableCitationInlineSpans,
    wrapBareXfCiteLines
} from "@/lib/xchat-citations";

export function preprocessXchatMarkdown(raw: string): string {
  if (!raw.trim()) {
    return raw;
  }
  let s = applyLeakedMarkupRules(raw);
  s = grokRenderBlocksToCitationMarkdown(s);
  s = grokRenderSelfClosingToCitationMarkdown(s);
  s = expandBracketCitationsToInlineCode(s);
  s = dedupeInlineRepeatedBareXfSentinels(s);
  s = collapseAdjacentDuplicateBareXfLines(s);
  s = stripNonRenderableBareCitationLines(s);
  s = wrapBareXfCiteLines(s);
  s = collapseAdjacentDuplicateWrappedXfChipLines(s);
  s = stripNonRenderableCitationInlineSpans(s);
  s = stripNonRenderableBareCitationLines(s);
  s = s.replace(/\*\*\*\*/g, "**");
  s = s.replace(/(?:\n[ \t]*){3,}/g, "\n\n");

  const lines = s.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (
      t.length > 0 &&
      t.length < 240 &&
      !t.startsWith("#") &&
      !t.startsWith("|") &&
      !t.startsWith("```") &&
      !t.startsWith("-") &&
      !t.startsWith("*") &&
      !t.includes("://") &&
      /^[A-Z][A-Za-z0-9 '&/%+.()–-]{0,44}:\s+\S/.test(t)
    ) {
      const colon = t.indexOf(":");
      const key = t.slice(0, colon).trim();
      const rest = t.slice(colon + 1).trim();
      /** Grok often writes comparison titles ("SPY vs. QQQ: …") and parenthetical tickers ("SPY (S&P 500 ETF): Closed …") — not summary keys. */
      const looksLikeFinanceProseTitle =
        /\bvs\.?\b/i.test(key) || key.includes("(") || key.includes(")");
      if (looksLikeFinanceProseTitle) {
        out.push(line);
      } else {
        out.push(`### ${key}`);
        out.push(rest);
      }
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
