import { resolveUsMarketDayContext } from "@/modules/scanner/us-market-day-context";

export type XchatQuoteFreshness = "cached_first" | "live";

export function messageRequestsLiveMarketRefresh(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /\blive\s+refresh\b/.test(t) || /\bfresh\s+(market\s+)?quotes?\b/.test(t);
}

/**
 * Broad match for prompts that are likely to lean on workspace book + options context
 * (cached snapshot + RAG is high value; generic chit-chat should not skip live Yahoo when building snapshot).
 */
export function looksLikePortfolioOrOptionsWorkspaceQuery(message: string): boolean {
  const t = message.trim();
  if (t.length < 3) {
    return false;
  }
  return /portfolio|watchlist|holding|position|account|equity|allocation|broker|custodian|covered\s+call|protective\s+put|cash-?secured|credit\s+spread|debit\s+spread|iron\s+condor|calendar\s+spread|diagonal|butterfly|straddle|strangle|option|calls?\b|puts?\b|strike|expir|theta|delta|gamma|vega|\biv\b|implied\s+vol|open\s+interest|\bp\/l\b|unrealized|mark\s+price|my\s+book|workspace/i.test(
    t
  );
}

export function resolveWorkspaceSnapshotQuoteNetwork(input: {
  message: string;
  reasoningMode: "fast" | "expert" | "heavy" | undefined;
  reasoningEffort: "none" | "low" | "medium" | "high" | "xhigh" | undefined;
  clientQuoteFreshness: XchatQuoteFreshness | undefined;
}): "cached_first" | "live" {
  if (input.clientQuoteFreshness === "live") {
    return "live";
  }
  if (messageRequestsLiveMarketRefresh(input.message)) {
    return "live";
  }
  const deep =
    input.reasoningMode === "expert" ||
    input.reasoningMode === "heavy" ||
    input.reasoningEffort !== undefined;
  if (deep) {
    return "live";
  }
  const m = resolveUsMarketDayContext(new Date());
  if (!m.marketWindowOpen) {
    return "live";
  }
  if (!looksLikePortfolioOrOptionsWorkspaceQuery(input.message)) {
    return "live";
  }
  return "cached_first";
}
