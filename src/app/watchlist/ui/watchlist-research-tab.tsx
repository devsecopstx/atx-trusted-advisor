"use client";

import { useEffect, useMemo, useState } from "react";

import { SymbolOhlcChartPanel } from "@/app/ui/symbol-ohlc-chart-panel";
import type { SymbolResearchPayload } from "@/modules/market/symbol-research";

type WatchlistResearchTabProps = {
  symbol: string;
  listLoadedAtLabel: string;
  seedQuote: SymbolResearchPayload["quote"] | null;
};

function formatUsd(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInt(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }
  return Math.round(n).toLocaleString();
}

function changeTone(change: number | undefined, changePercent: number | undefined): string {
  if (change == null || changePercent == null || !Number.isFinite(change) || !Number.isFinite(changePercent)) {
    return "";
  }
  if (change > 0 || changePercent > 0) {
    return "xf-watchlist-research__change--up";
  }
  if (change < 0 || changePercent < 0) {
    return "xf-watchlist-research__change--down";
  }
  return "";
}

function DayRangeBar({
  low,
  high,
  price
}: {
  low: number | undefined;
  high: number | undefined;
  price: number | undefined;
}) {
  const lowOk = typeof low === "number" && Number.isFinite(low);
  const highOk = typeof high === "number" && Number.isFinite(high);
  const priceOk = typeof price === "number" && Number.isFinite(price);
  if (!lowOk || !highOk || high <= low || !priceOk) {
    return <p className="xf-watchlist-research__muted">—</p>;
  }
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
  return (
    <div className="xf-watchlist-research__day-range">
      <span className="xf-watchlist-research__day-range-label">${formatUsd(low)}</span>
      <div className="xf-watchlist-research__day-range-track" aria-hidden>
        <span className="xf-watchlist-research__day-range-fill" style={{ width: `${pct}%` }} />
        <span className="xf-watchlist-research__day-range-marker" style={{ left: `${pct}%` }} />
      </div>
      <span className="xf-watchlist-research__day-range-label">${formatUsd(high)}</span>
    </div>
  );
}

export function WatchlistResearchTab({ symbol, listLoadedAtLabel, seedQuote }: WatchlistResearchTabProps) {
  const [payload, setPayload] = useState<SymbolResearchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setPayload(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/market/symbol-research?symbol=${encodeURIComponent(sym)}`, {
          credentials: "include",
          cache: "no-store"
        });
        const json = (await res.json()) as { data?: SymbolResearchPayload; error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? "Research data unavailable");
        }
        if (!cancelled && json.data) {
          setPayload(json.data);
        }
      } catch (e) {
        if (!cancelled) {
          setPayload(null);
          setError(e instanceof Error ? e.message : "Research data unavailable");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const quote = payload?.quote ?? seedQuote;
  const news = payload?.news ?? [];
  const asOfLabel = listLoadedAtLabel || (payload?.asOf ? new Date(payload.asOf).toLocaleString() : "latest");

  const changeLine = useMemo(() => {
    const ch = quote?.change;
    const pct = quote?.changePercent;
    if (ch == null || pct == null || !Number.isFinite(ch) || !Number.isFinite(pct)) {
      return "—";
    }
    const sign = ch >= 0 ? "+" : "";
    const pctSign = pct >= 0 ? "+" : "";
    return `${sign}$${formatUsd(Math.abs(ch))} (${pctSign}${pct.toFixed(3)}%)`;
  }, [quote?.change, quote?.changePercent]);

  if (loading && !quote) {
    return <p className="xf-watchlist-research__muted">Loading research…</p>;
  }

  if (error && !quote) {
    return <p className="xf-watchlist-research__error" role="alert">{error}</p>;
  }

  if (!quote) {
    return <p className="xf-watchlist-research__muted">No quote data for {symbol}.</p>;
  }

  return (
    <div className="xf-watchlist-research">
      <div className="xf-watchlist-research__grid">
        <section className="xf-watchlist-research__col" aria-labelledby={`research-quote-${symbol}`}>
          <header className="xf-watchlist-research__col-head">
            <h4 id={`research-quote-${symbol}`} className="xf-watchlist-research__col-title">
              Quote
            </h4>
            <p className="xf-watchlist-research__col-meta">As of {asOfLabel}</p>
          </header>
          <p className="xf-watchlist-research__price">${formatUsd(quote.price)}</p>
          <p className={`xf-watchlist-research__change ${changeTone(quote.change, quote.changePercent)}`}>
            {changeLine}
          </p>
          <dl className="xf-watchlist-research__metrics">
            <div>
              <dt>Bid x Size</dt>
              <dd>
                {quote.bid != null ? `$${formatUsd(quote.bid)}` : "—"}
                {quote.bidSize != null ? ` x ${formatInt(quote.bidSize)}` : ""}
              </dd>
            </div>
            <div>
              <dt>Ask x Size</dt>
              <dd>
                {quote.ask != null ? `$${formatUsd(quote.ask)}` : "—"}
                {quote.askSize != null ? ` x ${formatInt(quote.askSize)}` : ""}
              </dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd>{formatInt(quote.volume)}</dd>
            </div>
            <div>
              <dt>90 day avg. vol.</dt>
              <dd>{formatInt(quote.averageVolume)}</dd>
            </div>
            <div>
              <dt>Open</dt>
              <dd>${formatUsd(quote.open)}</dd>
            </div>
            <div>
              <dt>Previous close</dt>
              <dd>${formatUsd(quote.previousClose)}</dd>
            </div>
            <div className="xf-watchlist-research__metric-span">
              <dt>Day range</dt>
              <dd>
                <DayRangeBar low={quote.dayLow} high={quote.dayHigh} price={quote.price} />
              </dd>
            </div>
            <div>
              <dt>P/E ratio (TTM)</dt>
              <dd>{quote.trailingPe != null && Number.isFinite(quote.trailingPe) ? quote.trailingPe.toFixed(2) : "—"}</dd>
            </div>
            <div className="xf-watchlist-research__metric-span">
              <dt>52 week range</dt>
              <dd>
                ${formatUsd(quote.fiftyTwoWeekLow)} – ${formatUsd(quote.fiftyTwoWeekHigh)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="xf-watchlist-research__col" aria-labelledby={`research-chart-${symbol}`}>
          <header className="xf-watchlist-research__col-head">
            <h4 id={`research-chart-${symbol}`} className="xf-watchlist-research__col-title">
              Chart
            </h4>
            <p className="xf-watchlist-research__col-meta">
              {quote.companyName ?? symbol}
              {quote.open != null && quote.price != null
                ? ` · O: ${formatUsd(quote.open)} H: ${formatUsd(quote.dayHigh)} L: ${formatUsd(quote.dayLow)} C: ${formatUsd(quote.price)}`
                : ""}
            </p>
          </header>
          <div className="xf-watchlist-research__chart">
            <SymbolOhlcChartPanel enabled initialRange="1d" showRangeSelector symbol={symbol} variant="compact" />
          </div>
        </section>

        <section className="xf-watchlist-research__col" aria-labelledby={`research-news-${symbol}`}>
          <header className="xf-watchlist-research__col-head">
            <h4 id={`research-news-${symbol}`} className="xf-watchlist-research__col-title">
              News
            </h4>
          </header>
          {loading && news.length === 0 ? (
            <p className="xf-watchlist-research__muted">Loading headlines…</p>
          ) : news.length === 0 ? (
            <p className="xf-watchlist-research__muted">No recent headlines for this symbol.</p>
          ) : (
            <ul className="xf-watchlist-research__news-list">
              {news.map((item) => (
                <li key={`${item.link}:${item.title}`} className="xf-watchlist-research__news-item">
                  <a
                    className="xf-watchlist-research__news-title"
                    href={item.link}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {item.title}
                  </a>
                  <div className="xf-watchlist-research__news-meta">
                    {item.publisher ? <span>{item.publisher}</span> : null}
                    {item.publishedAtLabel ? <time>{item.publishedAtLabel}</time> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="xf-watchlist-research__foot">
        {payload?.disclaimer ?? "Market data from Yahoo Finance — delayed. Not exchange-grade."}
      </p>
    </div>
  );
}
