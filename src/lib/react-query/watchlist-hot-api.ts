export type WatchlistHotRow = {
  symbol: string;
  spot: number | null;
  changePercent: number | null;
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
};

export type WatchlistHotPayload = {
  rows: WatchlistHotRow[];
  scanned: number;
};

function normalizeHotRow(x: WatchlistHotRow): WatchlistHotRow | null {
  if (
    typeof x?.symbol !== "string" ||
    (x.spot !== null && x.spot !== undefined && typeof x.spot !== "number") ||
    (x.changePercent !== null &&
      x.changePercent !== undefined &&
      typeof x.changePercent !== "number") ||
    typeof x?.impliedVolatilityPercent !== "number" ||
    typeof x?.openInterest !== "number" ||
    typeof x?.strike !== "number" ||
    (x.contractType !== "call" && x.contractType !== "put")
  ) {
    return null;
  }
  return {
    symbol: x.symbol,
    spot: typeof x.spot === "number" && Number.isFinite(x.spot) ? x.spot : null,
    changePercent:
      typeof x.changePercent === "number" && Number.isFinite(x.changePercent) ? x.changePercent : null,
    impliedVolatilityPercent: x.impliedVolatilityPercent,
    openInterest: x.openInterest,
    strike: x.strike,
    contractType: x.contractType
  };
}

export async function fetchWatchlistHotCompact(
  portfolioId: string | null,
  limit = 5
): Promise<WatchlistHotPayload> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (portfolioId) {
    qs.set("portfolioId", portfolioId);
  }
  const res = await fetch(`/api/app-user/find-options/watchlist-hot?${qs.toString()}`, {
    credentials: "include"
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { rows?: WatchlistHotRow[]; scanned?: number };
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? "Could not load watchlist scan");
  }
  const rows = (body.data?.rows ?? [])
    .map((row) => normalizeHotRow(row))
    .filter((row): row is WatchlistHotRow => row !== null);
  return {
    rows,
    scanned: typeof body.data?.scanned === "number" ? body.data.scanned : rows.length
  };
}
