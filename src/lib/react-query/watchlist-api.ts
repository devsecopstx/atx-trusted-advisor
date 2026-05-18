import { readFetchJsonBody } from "@/lib/read-fetch-json-body";
import type { WatchlistRowStatus } from "@/modules/core-admin/types";

export type WatchlistApiData = {
  activeWatchlistId?: string | null;
  watchlists?: Array<{
    id: string;
    name: string;
    symbolCount?: number;
    isDefault?: boolean;
    updatedAt?: string | null;
  }>;
  name?: string;
  symbols?: Array<{
    symbol: string;
    addedAt: string;
    lineType?: string;
    strategy?: string;
    quantity?: number;
    entryPrice?: number;
    rationale?: string;
    rowStatus?: WatchlistRowStatus;
    lastPrice?: number;
    lastUpdatedAt?: string;
  }>;
  symbolsWithQuotes?: Array<{
    symbol: string;
    addedAt: string;
    lineType?: string;
    strategy?: string;
    quantity?: number;
    entryPrice?: number;
    rationale?: string;
    rowStatus?: WatchlistRowStatus;
    lastPrice?: number;
    lastUpdatedAt?: string;
    quote: unknown;
    chainGlance?: unknown;
    technicals?: unknown;
  }>;
};

export async function fetchWatchlistDesk(
  watchlistBaseUrl: string,
  watchlistFetchQuery: string
): Promise<WatchlistApiData> {
  const res = await fetch(`${watchlistBaseUrl}?${watchlistFetchQuery}`, { credentials: "include" });
  const { json } = await readFetchJsonBody<{ data?: WatchlistApiData; error?: string }>(res);
  if (!res.ok) {
    throw new Error(
      json.error ??
        (res.status === 429 ? "Too many requests. Please wait a moment and retry." : "Failed to load watchlist")
    );
  }
  if (!json.data) {
    throw new Error("Invalid response");
  }
  return json.data;
}
