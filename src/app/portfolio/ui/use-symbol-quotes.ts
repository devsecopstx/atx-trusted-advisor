"use client";

import { useEffect, useState } from "react";

import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export function useSymbolQuotes(symbols: string[]): {
  quotes: Record<string, SymbolLookupResult | null>;
  loading: boolean;
} {
  const sortedKey = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort().join(",");

  const [fetched, setFetched] = useState<Record<string, SymbolLookupResult | null>>({});
  const [loading, setLoading] = useState(false);

  const quotes = sortedKey.length > 0 ? fetched : {};

  useEffect(() => {
    if (!sortedKey) {
      return;
    }
    const list = sortedKey.split(",");
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
      }
    });
    const qs = list.map((s) => encodeURIComponent(s)).join(",");
    fetch(`/api/market/symbol-quotes?symbols=${qs}`, { credentials: "include" })
      .then((r) => r.json() as Promise<{ data?: Record<string, SymbolLookupResult | null> }>)
      .then((payload) => {
        if (!cancelled) {
          setFetched(payload.data ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetched({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sortedKey]);

  return { quotes, loading };
}
