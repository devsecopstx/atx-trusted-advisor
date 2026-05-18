import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export type SymbolQuotesPayload = {
  data?: Record<string, SymbolLookupResult | null>;
  brokerImportSuspended?: boolean;
};

export async function fetchSymbolQuotes(
  symbols: readonly string[],
  portfolioIdHex?: string
): Promise<Record<string, SymbolLookupResult | null>> {
  const list = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (list.length === 0) {
    return {};
  }
  const qs = list.map((s) => encodeURIComponent(s)).join(",");
  const portfolioQs = portfolioIdHex?.trim()
    ? `&portfolioId=${encodeURIComponent(portfolioIdHex.trim())}`
    : "";
  const response = await fetch(`/api/market/symbol-quotes?symbols=${qs}${portfolioQs}`, {
    credentials: "include"
  });
  const payload = (await response.json()) as SymbolQuotesPayload;
  return payload.data ?? {};
}
