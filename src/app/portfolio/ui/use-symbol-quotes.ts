"use client";

import { useQuery } from "@tanstack/react-query";

import { symbolQuotesQueryKeys } from "@/lib/react-query/query-keys";
import { fetchSymbolQuotes } from "@/lib/react-query/symbol-quotes-api";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export function useSymbolQuotes(symbols: string[]): {
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
};
export function useSymbolQuotes(
  symbols: string[],
  options: { refreshMs?: number; portfolioIdHex?: string }
): {
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
};
export function useSymbolQuotes(
  symbols: string[],
  options?: { refreshMs?: number; portfolioIdHex?: string }
): {
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
} {
  const sortedKey = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort().join(",");
  const refreshMs = options?.refreshMs ?? 0;
  const portfolioIdHex = options?.portfolioIdHex?.trim() ?? "";

  const query = useQuery({
    queryKey: symbolQuotesQueryKeys.list(sortedKey, portfolioIdHex),
    queryFn: () => fetchSymbolQuotes(sortedKey ? sortedKey.split(",") : [], portfolioIdHex),
    enabled: sortedKey.length > 0,
    staleTime: refreshMs > 0 ? Math.max(refreshMs - 1000, 5_000) : 30_000,
    refetchInterval: refreshMs > 0 ? refreshMs : false,
    refetchIntervalInBackground: false
  });

  return {
    quotes: sortedKey.length > 0 ? (query.data ?? {}) : {},
    loading: query.isPending && sortedKey.length > 0
  };
}
