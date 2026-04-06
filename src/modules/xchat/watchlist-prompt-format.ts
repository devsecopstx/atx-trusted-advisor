/**
 * Shared watchlist presentation for xChat: direct watchlist replies, workspace snapshot JSON,
 * and atx_function tool payloads — keeps "show my watchlist" vs portfolio context aligned.
 */

export function formatWatchlistAddedAtUtc(isoLike: string | undefined): string {
  if (!isoLike) {
    return "unknown time";
  }
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) {
    return isoLike;
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  });
}

/** Stored desk target entry (USD). Not live quote — use for tool + snapshot + direct watchlist lines. */
export function formatWatchlistTargetEntryStored(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "not set";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Watchlist page "Target entry" column (read mode): whole-dollar notional = round(100 × live quote).
 * Matches `watchlist-console` `getTargetEntryNumeric` / `formatTargetEntryCell` — not Mongo `entryPrice`.
 */
export function formatWatchlistTargetEntryNotional100xFromQuotePrice(price: unknown): string {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return "—";
  }
  const v = Math.round(100 * price);
  return v.toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

/** Live Yahoo last / quote — USD for “show my watchlist” and tool JSON. */
export function formatWatchlistSpotPriceUsd(price: unknown): string {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

/**
 * Watchlist UI “Target entry” column as currency: round(100 × spot) whole USD
 * (same basis as {@link formatWatchlistTargetEntryNotional100xFromQuotePrice}).
 */
export function formatWatchlistTargetEntryNotional100xUsd(price: unknown): string {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return "—";
  }
  const v = Math.round(100 * price);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(v);
}

/** Legacy plain notional string (e.g. `"24,500"`) → `$24,500` for older cached tool payloads. */
export function formatWatchlistNotionalPlainDisplayAsUsd(display: string | undefined): string {
  if (!display || display === "—") {
    return "—";
  }
  const n = Number(String(display).replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n);
}
