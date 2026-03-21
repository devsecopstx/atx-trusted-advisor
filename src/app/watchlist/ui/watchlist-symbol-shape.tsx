"use client";

import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

function formatPrice(value: number | undefined, currency?: string): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const cur = currency?.trim() || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

function formatVolume(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) {
    return "—";
  }
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B vol`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M vol`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K vol`;
  return `${Math.round(n)} vol`;
}

function formatRange(low: number | undefined, high: number | undefined, currency?: string): string {
  if (low == null || high == null || Number.isNaN(low) || Number.isNaN(high)) {
    return "—";
  }
  return `${formatPrice(low, currency)} – ${formatPrice(high, currency)}`;
}

export type WatchlistSymbolShapeProps = {
  symbol: string;
  quote: SymbolLookupResult | null;
  onRemoveFromWatchlist: () => void;
  removeBusy?: boolean;
};

export function WatchlistSymbolShape({
  symbol,
  quote,
  onRemoveFromWatchlist,
  removeBusy
}: WatchlistSymbolShapeProps) {
  const company = quote?.companyName?.trim() || symbol;
  const pct = quote?.changePercent;
  const ch = quote?.change;
  const up = pct != null ? pct > 0 : ch != null ? ch > 0 : false;
  const down = pct != null ? pct < 0 : ch != null ? ch < 0 : false;
  const deltaClass = up
    ? "xf-symbol-shape__delta xf-symbol-shape__delta--up"
    : down
      ? "xf-symbol-shape__delta xf-symbol-shape__delta--down"
      : "xf-symbol-shape__delta xf-symbol-shape__delta--flat";

  const pctStr =
    pct != null && !Number.isNaN(pct)
      ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
      : null;
  const chStr =
    ch != null && !Number.isNaN(ch) ? `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}` : null;
  const deltaParts = [chStr, pctStr].filter(Boolean).join(" ");

  const asOf = new Date().toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });

  return (
    <div className="xf-symbol-shape">
      {quote?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote CDN; avoids next.config churn
        <img
          alt=""
          className="xf-symbol-shape__logo"
          height={40}
          src={quote.logoUrl}
          width={40}
        />
      ) : (
        <div
          aria-hidden
          className="xf-symbol-shape__logo xf-symbol-shape__logo-fallback"
        >
          {symbol.slice(0, 2)}
        </div>
      )}
      <div className="xf-symbol-shape__body">
        <p className="xf-symbol-shape__exchange">
          {quote?.source === "yahoo-finance2"
            ? "US equity · delayed quote"
            : "Market data · USD"}
        </p>
        <div className="xf-symbol-shape__title-row">
          <h3 className="xf-symbol-shape__title">
            {company} ({symbol})
          </h3>
          <button
            aria-label={`Remove ${symbol} from watchlist`}
            className="xf-symbol-shape__star"
            disabled={removeBusy}
            type="button"
            onClick={onRemoveFromWatchlist}
          >
            <svg aria-hidden fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>
        </div>
        <div className="xf-symbol-shape__price-row">
          <span className="xf-symbol-shape__price">
            {formatPrice(quote?.price, quote?.currency)}
          </span>
          {deltaParts ? <span className={deltaClass}>{deltaParts}</span> : null}
        </div>
        <p className="xf-symbol-shape__meta">
          {formatVolume(quote?.volume)} · {formatRange(quote?.low, quote?.high, quote?.currency)}
        </p>
        <p className="xf-symbol-shape__asof">As of {asOf}</p>
        {quote?.companyOverview ? (
          <p className="xf-symbol-shape__blurb" title={quote.companyOverview}>
            {quote.companyOverview}
          </p>
        ) : null}
      </div>
    </div>
  );
}
