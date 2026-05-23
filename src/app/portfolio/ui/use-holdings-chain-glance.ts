"use client";

import { useQuery } from "@tanstack/react-query";

import type { HoldingsChainGlance } from "@/app/portfolio/lib/holdings-row-metrics";
import { fetchChainGlance } from "@/lib/react-query/chain-glance-api";
import { chainGlanceQueryKeys } from "@/lib/react-query/query-keys";

const CHAIN_GLANCE_REFRESH_MS = 180_000;

export function useHoldingsChainGlance(symbols: string[]): {
  chainGlance: Record<string, HoldingsChainGlance | null>;
  loading: boolean;
} {
  const sortedKey = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].sort().join(",");

  const query = useQuery({
    queryKey: chainGlanceQueryKeys.list(sortedKey),
    queryFn: () => fetchChainGlance(sortedKey ? sortedKey.split(",") : []),
    enabled: sortedKey.length > 0,
    staleTime: 120_000,
    refetchInterval: CHAIN_GLANCE_REFRESH_MS,
    refetchIntervalInBackground: false
  });

  return {
    chainGlance: sortedKey.length > 0 ? (query.data ?? {}) : {},
    loading: query.isPending && sortedKey.length > 0
  };
}
