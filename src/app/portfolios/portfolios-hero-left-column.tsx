"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { UploadIcon } from "@/app/admin/ui/crud-icons";
import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { NearestExpiryOptionsGlance } from "@/modules/find-options/options-hot-scan";
import { type MarketDayContext, usMarketSessionStatusLabel } from "@/modules/scanner/us-market-day-context";

export type PortfoliosHeroTopHolding = {
  symbol: string;
  bookUsd: number;
};

type PulseData = {
  market: MarketDayContext;
  indices: { symbol: string; price?: number; changePercent?: number }[];
  news: { title: string; link: string; publisher?: string }[];
  optionsGlance: { symbol: string; highlight: NearestExpiryOptionsGlance | null }[];
};

function formatOi(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(Math.round(n));
}

function formatChgPct(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) {
    return "—";
  }
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

export function PortfoliosHeroLeftColumn({
  marketContext,
  topHoldings,
  defaultPortfolioId
}: {
  marketContext: MarketDayContext;
  topHoldings: PortfoliosHeroTopHolding[];
  defaultPortfolioId: string | null;
}) {
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [pulseLoading, setPulseLoading] = useState(true);

  const holdingsKey = useMemo(
    () => topHoldings.slice(0, 2).map((h) => h.symbol).join(","),
    [topHoldings]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPulseLoading(true);
      try {
        const qs = holdingsKey ? `?holdings=${encodeURIComponent(holdingsKey)}` : "";
        const res = await fetch(`/api/market/workspace-pulse${qs}`, { credentials: "include" });
        const body = (await res.json()) as { data?: PulseData };
        if (!cancelled && body.data) {
          setPulse(body.data);
        }
      } catch {
        if (!cancelled) {
          setPulse(null);
        }
      } finally {
        if (!cancelled) {
          setPulseLoading(false);
        }
      }
    }
    void load();
    const t = setInterval(() => void load(), 180_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [holdingsKey]);

  const m = pulse?.market ?? marketContext;
  const status = usMarketSessionStatusLabel(m);
  const news = pulse?.news ?? [];
  const indices = pulse?.indices ?? [];
  const optionsGlance = pulse?.optionsGlance ?? [];

  const importHref = defaultPortfolioId
    ? `/import-activity?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
    : "/import-activity";

  const watchlistHref = defaultPortfolioId
    ? `/watchlist?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
    : "/watchlist";
  const alertsHref = defaultPortfolioId
    ? `/portfolio/alerts?portfolioId=${encodeURIComponent(defaultPortfolioId)}`
    : "/portfolio/alerts";

  const primarySymbol = topHoldings[0]?.symbol;

  return (
    <div className="portfolios-hero-left flex min-w-0 flex-col gap-2" aria-label="Portfolio overview at a glance">
      <section className="portfolios-hero-left__panel xf-noise-overlay">
        <div className="portfolios-hero-left__panel-head">
          <h2 className="portfolios-hero-left__panel-title">Markets &amp; news</h2>
          <span
            className={`portfolios-hero-left__badge${status.label === "Open" ? " portfolios-hero-left__badge--open" : ""}`}
          >
            {status.label}
          </span>
        </div>
        <p className="portfolios-hero-left__meta">
          {m.marketDate} · {m.timezone} · {status.detail}
        </p>
        <div className="portfolios-hero-left__indices">
          {indices.map((ix) => (
            <span key={ix.symbol} className="portfolios-hero-left__index-pill font-mono tabular-nums">
              <span className="text-[var(--xf-text-100)]">{ix.symbol}</span>{" "}
              {ix.price !== undefined && Number.isFinite(ix.price) ? (
                <span className="text-[var(--xf-text-200)]">
                  {ix.price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-[var(--xf-text-300)]">—</span>
              )}{" "}
              <span
                className={
                  (ix.changePercent ?? 0) > 0
                    ? "text-[var(--xf-gain-green)]"
                    : (ix.changePercent ?? 0) < 0
                      ? "text-red-300"
                      : "text-[var(--xf-text-300)]"
                }
              >
                {formatChgPct(ix.changePercent)}
              </span>
            </span>
          ))}
        </div>
        <div className="portfolios-hero-left__news">
          {pulseLoading && news.length === 0 ? (
            <p className="portfolios-hero-left__muted">Loading headlines…</p>
          ) : news.length === 0 ? (
            <p className="portfolios-hero-left__muted">No headlines right now.</p>
          ) : (
            <ul className="portfolios-hero-left__news-list">
              {news.slice(0, 3).map((item) => (
                <li key={item.link}>
                  <a
                    className="portfolios-hero-left__news-link"
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.title}
                  </a>
                  {item.publisher ? (
                    <span className="portfolios-hero-left__news-pub"> · {item.publisher}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="portfolios-hero-left__panel xf-noise-overlay">
        <div className="portfolios-hero-left__panel-head">
          <h2 className="portfolios-hero-left__panel-title">Holdings &amp; options</h2>
          {primarySymbol ? (
            <Link className="portfolios-hero-left__mini-link" href={`/xoptions/full-chain?symbol=${primarySymbol}`}>
              Chain
            </Link>
          ) : null}
        </div>
        <p className="portfolios-hero-left__muted portfolios-hero-left__row-label">Top book (stocks)</p>
        {topHoldings.length === 0 ? (
          <p className="portfolios-hero-left__muted">Add positions from Portfolio.</p>
        ) : (
          <ul className="portfolios-hero-left__holdings">
            {topHoldings.map((h) => (
              <li key={h.symbol} className="portfolios-hero-left__holding-row font-mono tabular-nums">
                <span className="portfolios-hero-left__holding-sym flex min-w-0 items-center gap-2">
                  <PortfolioSymbolMark symbol={h.symbol} size={22} />
                  <span className="text-[var(--xf-text-100)]">{h.symbol}</span>
                </span>
                <span className="shrink-0 text-[var(--xf-text-300)]">{formatUsdWhole(h.bookUsd)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="portfolios-hero-left__muted portfolios-hero-left__row-label mt-2">High IV / OI (nearest expiry)</p>
        {pulseLoading && optionsGlance.length === 0 ? (
          <p className="portfolios-hero-left__muted">Loading…</p>
        ) : optionsGlance.length === 0 ? (
          <p className="portfolios-hero-left__muted">—</p>
        ) : (
          <ul className="portfolios-hero-left__options-glance">
            {optionsGlance.map((row) => (
              <li key={row.symbol} className="portfolios-hero-left__options-line font-mono text-xs">
                {row.highlight ? (
                  <>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <PortfolioSymbolMark symbol={row.symbol} size={18} />
                      <span className="text-[var(--xf-text-100)]">{row.symbol}</span>
                    </span>{" "}
                    <span className="text-[var(--xf-text-300)]">
                      {row.highlight.contractType} {row.highlight.strike} · IV {row.highlight.impliedVolatilityPercent}%
                      · OI {formatOi(row.highlight.openInterest)}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-[var(--xf-text-300)]">
                    <PortfolioSymbolMark symbol={row.symbol} size={18} />
                    <span>{row.symbol} — no chain data</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="portfolios-hero-left__panel portfolios-hero-left__panel--cta xf-noise-overlay">
        <h2 className="portfolios-hero-left__panel-title">Broker import</h2>
        <p className="portfolios-hero-left__muted mb-2">
          Merrill or Fidelity CSV into your linked accounts — map by external ref.
        </p>
        <Link
          className="portfolios-hero-left__cta inline-flex items-center gap-2 rounded-md bg-[var(--xf-gain-green)] px-3 py-2 text-sm font-medium text-black hover:opacity-90"
          href={importHref}
        >
          <UploadIcon className="crud-icon h-4 w-4" aria-hidden />
          Import broker activity
        </Link>
        <p className="portfolios-hero-left__muted portfolios-hero-left__row-label mt-2">Watchlist &amp; Alerts</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <Link className="portfolios-hero-left__mini-link" href="/portfolio">
            Portfolio desk
          </Link>
          <Link className="portfolios-hero-left__mini-link" href={watchlistHref}>
            Watchlist
          </Link>
          <Link className="portfolios-hero-left__mini-link" href={alertsHref}>
            Alerts
          </Link>
        </div>
      </section>
    </div>
  );
}
