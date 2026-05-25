import {
    fetchSymbolResearch,
    type SymbolResearchPayload
} from "@/modules/market/symbol-research";

import type {
    WheelRelatedSupplierCandidate,
    WheelSupplierQuoteSnapshot,
    WheelSupplierResearch,
    WheelSupplierResearchHeadline
} from "./wheel-types";

export function buildSupplierResearchSummary(
  symbol: string,
  quote: WheelSupplierQuoteSnapshot,
  headlines: WheelSupplierResearchHeadline[]
): string {
  const parts: string[] = [];
  if (quote.changePercent != null && Number.isFinite(quote.changePercent)) {
    const sign = quote.changePercent >= 0 ? "+" : "";
    parts.push(`${sign}${quote.changePercent.toFixed(2)}% session`);
  }
  if (quote.trailingPe != null && Number.isFinite(quote.trailingPe)) {
    parts.push(`P/E ${quote.trailingPe.toFixed(1)}`);
  }
  const top = headlines[0];
  if (top?.title) {
    const clipped = top.title.length > 140 ? `${top.title.slice(0, 137)}…` : top.title;
    parts.push(`Latest: ${clipped}`);
  }
  return parts.length > 0
    ? parts.join(" · ")
    : `Delayed quote for ${symbol} as of report generation.`;
}

export function mapSymbolResearchToWheelSupplier(
  candidate: WheelRelatedSupplierCandidate,
  payload: SymbolResearchPayload
): WheelRelatedSupplierCandidate {
  const q = payload.quote;
  const quoteSnapshot: WheelSupplierQuoteSnapshot = {
    price:
      typeof q.price === "number" && Number.isFinite(q.price) && q.price > 0
        ? q.price
        : candidate.spotPrice,
    change: q.change,
    changePercent: q.changePercent,
    bid: q.bid,
    ask: q.ask,
    volume: q.volume,
    dayLow: q.dayLow,
    dayHigh: q.dayHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    trailingPe: q.trailingPe,
    asOfIso: payload.asOf
  };
  const headlines: WheelSupplierResearchHeadline[] = payload.news.slice(0, 5).map((item) => ({
    title: item.title,
    link: item.link,
    publisher: item.publisher,
    publishedAtLabel: item.publishedAtLabel
  }));
  const research: WheelSupplierResearch = {
    quote: quoteSnapshot,
    headlines,
    summary: buildSupplierResearchSummary(candidate.symbol, quoteSnapshot, headlines)
  };
  return {
    ...candidate,
    spotPrice: quoteSnapshot.price,
    companyName: q.companyName?.trim() || candidate.companyName,
    research
  };
}

/** Attach delayed Yahoo quote + headline research for institutional wheel reports. */
export async function enrichWheelSupplierCandidates(
  candidates: WheelRelatedSupplierCandidate[]
): Promise<WheelRelatedSupplierCandidate[]> {
  const enriched = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const payload = await fetchSymbolResearch(candidate.symbol);
        if (!payload) {
          return candidate;
        }
        return mapSymbolResearchToWheelSupplier(candidate, payload);
      } catch {
        return candidate;
      }
    })
  );
  return enriched;
}
