"use client";

import { useEffect, useState } from "react";

import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export function useSymbolQuotes(symbols: string[]): {
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
};
export function useSymbolQuotes(
  symbols: string[],
  options: { refreshMs?: number }
): {
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
};
export function useSymbolQuotes(
  symbols: string[],
  options?: { refreshMs?: number }
): {
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
} {
  const sortedKey = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort().join(",");
  const refreshMs = options?.refreshMs ?? 0;

  const [fetched, setFetched] = useState<Record<string, SymbolLookupResult | null>>({});
  const [loading, setLoading] = useState(false);

  const quotes = sortedKey.length > 0 ? fetched : {};

  useEffect(() => {
    if (!sortedKey) {
      return;
    }
    const list = sortedKey.split(",");
    let cancelled = false;
    const fetchQuotes = async () => {
      if (cancelled) {
        return;
      }
      setLoading(true);
      try {
        const qs = list.map((s) => encodeURIComponent(s)).join(",");
        const response = await fetch(`/api/market/symbol-quotes?symbols=${qs}`, { credentials: "include" });
        const payload = (await response.json()) as { data?: Record<string, SymbolLookupResult | null> };
        if (!cancelled) {
          setFetched(payload.data ?? {});
        }
      } catch {
        if (!cancelled) {
          setFetched({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void fetchQuotes();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (refreshMs > 0) {
      intervalId = setInterval(() => {
        void fetchQuotes();
      }, refreshMs);
    }
    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refreshMs, sortedKey]);

  return { quotes, loading };
}
