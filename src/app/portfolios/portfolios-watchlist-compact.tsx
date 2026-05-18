"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ExternalLinkIcon } from "@/app/admin/ui/crud-icons";
import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import {
    buildXoptionsStrategyBuilderHref,
    isValidXoptionsUnderlyingSymbol
} from "@/lib/xoptions/xoptions-desk-deep-link";
import { watchlistHotQueryKeys } from "@/lib/react-query/query-keys";
import { fetchWatchlistHotCompact, type WatchlistHotRow } from "@/lib/react-query/watchlist-hot-api";

import type { PortfoliosWorkspaceDeskHints } from "./portfolios-workspace-client";

function formatSpotUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatOi(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(Math.round(n));
}

function formatChgPct(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) {
    return "—";
  }
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

function chgPctToneClass(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) {
    return "text-[var(--xf-text-200)]";
  }
  if (p > 0) {
    return "text-[var(--xf-gain-green)]";
  }
  if (p < 0) {
    return "text-red-300";
  }
  return "text-[var(--xf-text-200)]";
}

type Props = {
  portfolioId: string | null;
  /** Server-prefetched desk context (Mongo watchlist + alerts + optional IBKR); hot IV/OI rows still load client-side. */
  deskHints?: PortfoliosWorkspaceDeskHints | null;
  /** Increment to re-fetch hot IV/OI rows after watchlist mutations elsewhere on the page. */
  refreshKey?: number;
  /** When set, “View & manage watchlist” / empty-state actions open inline instead of navigating to `/watchlist`. */
  onOpenFullWatchlist?: () => void;
};

export function PortfoliosWatchlistCompact({
  portfolioId,
  deskHints = null,
  refreshKey = 0,
  onOpenFullWatchlist
}: Props) {
  const hotQuery = useQuery({
    queryKey: [...watchlistHotQueryKeys.compact(portfolioId, 5), String(refreshKey)],
    queryFn: () => fetchWatchlistHotCompact(portfolioId, 5),
    staleTime: 45_000
  });

  const rows: WatchlistHotRow[] = hotQuery.data?.rows ?? [];
  const scanned = hotQuery.data?.scanned ?? 0;
  const loading = hotQuery.isPending && !hotQuery.data;
  const err =
    hotQuery.error instanceof Error
      ? hotQuery.error.message
      : hotQuery.isError
        ? "Network error"
        : null;

  const watchlistHref =
    portfolioId !== null
      ? `/watchlist?portfolioId=${encodeURIComponent(portfolioId)}`
      : "/watchlist";
  const alertsHref =
    portfolioId !== null
      ? `/portfolio/alerts?portfolioId=${encodeURIComponent(portfolioId)}`
      : "/portfolio/alerts";

  return (
    <section
      className="portfolios-watchlist-compact xf-noise-overlay rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3"
      id="portfolios-watchlist"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]">
            Watchlist &amp; Alerts
          </h2>
          <p className="mt-0.5 mb-0 text-[0.62rem] leading-snug text-[var(--xf-text-400)]">
            Top 5 by IV / OI (nearest expiry, watchlist symbols only)
            {deskHints &&
            (deskHints.watchlistSymbolCount > 0 ||
              deskHints.activeAlertsCount > 0 ||
              deskHints.ibkrLinkedAccountCount != null) ? (
              <>
                {" "}
                · {deskHints.watchlistSymbolCount} wl sym · {deskHints.activeAlertsCount} open alert
                {deskHints.ibkrLinkedAccountCount != null
                  ? ` · IBKR ${deskHints.ibkrLinkedAccountCount} acct`
                  : ""}
              </>
            ) : null}
          </p>
          {deskHints && deskHints.watchlistSymbolCount > 0 ? (
            <p className="mt-1 mb-0 max-w-[22rem] text-[0.58rem] leading-snug text-[var(--xf-text-500)]">
              Same tenant watchlist as{" "}
              <Link className="text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] underline-offset-2 hover:underline" href={watchlistHref}>
                /watchlist
              </Link>{" "}
              (one list per user). The table below only shows underlyings that clear the liquid IV/OI bar — not a second
              list.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {onOpenFullWatchlist ? (
            <button
              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-[var(--xf-bg-800)] px-2 py-1 text-xs font-medium text-[var(--xf-text-100)] hover:bg-[var(--xf-bg-700)]"
              type="button"
              title="Open full watchlist inline: details, import/export, add and remove rows"
              onClick={onOpenFullWatchlist}
            >
              View &amp; manage watchlist
              <ExternalLinkIcon className="h-3 w-3 opacity-80" aria-hidden />
            </button>
          ) : (
            <Link
              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-[var(--xf-bg-800)] px-2 py-1 text-xs font-medium text-[var(--xf-text-100)] hover:bg-[var(--xf-bg-700)]"
              href={watchlistHref}
              title="Open full watchlist: details, import/export, add and remove rows"
            >
              View &amp; manage watchlist
              <ExternalLinkIcon className="h-3 w-3 opacity-80" aria-hidden />
            </Link>
          )}
          <Link
            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-[var(--xf-bg-800)] px-2 py-1 text-xs font-medium text-[var(--xf-text-100)] hover:bg-[var(--xf-bg-700)]"
            href={alertsHref}
            title="Portfolio price and desk alerts"
          >
            <svg
              aria-hidden
              className="h-3.5 w-3.5 opacity-90"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 5a4 4 0 00-4 4v2.8c0 .9-.3 1.8-.9 2.5L6 16h12l-1.1-1.7a4.2 4.2 0 01-.9-2.5V9a4 4 0 00-4-4z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
              <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeLinecap="round" strokeWidth={1.5} />
            </svg>
            Alerts
          </Link>
        </div>
      </div>

      {deskHints?.watchlistPreviewSymbols && deskHints.watchlistPreviewSymbols.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          <span className="text-[0.58rem] font-medium uppercase tracking-wide text-[var(--xf-text-500)]">
            Desk symbols
          </span>
          <div className="flex w-full flex-wrap gap-1">
            {deskHints.watchlistPreviewSymbols.map((sym, i) => {
              const xoHref =
                portfolioId && isValidXoptionsUnderlyingSymbol(sym)
                  ? buildXoptionsStrategyBuilderHref(portfolioId, sym)
                  : null;
              const inner = (
                <>
                  <PortfolioSymbolMark symbol={sym} size={18} />
                  <span className="min-w-0 truncate">{sym}</span>
                </>
              );
              const className =
                "inline-flex max-w-[13rem] items-center gap-1 truncate rounded border border-white/10 bg-[var(--xf-bg-800)] py-0.5 pl-1 pr-1.5 font-mono text-[0.62rem] font-semibold text-[var(--xf-text-200)] transition-colors hover:border-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_40%,transparent)] hover:text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))]";
              return xoHref ? (
                <Link key={`${sym}-${i}`} className={className} href={xoHref} title={`Open ${sym} in xOptions`}>
                  {inner}
                </Link>
              ) : (
                <span key={`${sym}-${i}`} className={className} title={sym}>
                  {inner}
                </span>
              );
            })}
          </div>
          {deskHints.watchlistSymbolCount > deskHints.watchlistPreviewSymbols.length ? (
            <p className="mb-0 mt-1 w-full text-[0.58rem] text-[var(--xf-text-500)]">
              +{deskHints.watchlistSymbolCount - deskHints.watchlistPreviewSymbols.length} more on full watchlist
            </p>
          ) : null}
        </div>
      ) : null}

      {err ? (
        <p className="text-xs text-red-300" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-[var(--xf-text-300)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs leading-relaxed text-[var(--xf-text-400)]">
          {deskHints && deskHints.watchlistSymbolCount > 0 ? (
            <>
              No underlying met the hot scan (nearest expiry, ~70% IV and 100+ OI) for your{" "}
              {deskHints.watchlistSymbolCount} watchlist leg{deskHints.watchlistSymbolCount === 1 ? "" : "s"}. Open the
              full watchlist for desk metrics; equity tickers scan on the root symbol, option legs on their underlying.
            </>
          ) : (
            <>Your watchlist is empty.</>
          )}{" "}
          {onOpenFullWatchlist ? (
            <button
              className="text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] underline hover:no-underline"
              type="button"
              onClick={onOpenFullWatchlist}
            >
              Open watchlist
            </button>
          ) : (
            <Link
              className="text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] underline hover:no-underline"
              href={watchlistHref}
            >
              Open watchlist
            </Link>
          )}
          {deskHints && deskHints.watchlistSymbolCount > 0 ? "" : " to add tickers."}
        </p>
      ) : (
        <>
          <div className="portfolios-watchlist-compact__scroll overflow-x-auto">
            <table className="portfolios-watchlist-compact__table min-w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--xf-text-300)]">
                  <th className="pb-1 pr-1 font-medium" scope="col">
                    Icon
                  </th>
                  <th className="pb-1 pr-2 font-medium" scope="col">
                    Sym
                  </th>
                  <th className="pb-1 pr-2 font-medium" scope="col">
                    Spot
                  </th>
                  <th className="pb-1 pr-2 font-medium" scope="col">
                    Day %
                  </th>
                  <th className="pb-1 pr-2 font-medium" scope="col">
                    IV
                  </th>
                  <th className="pb-1 pr-2 font-medium" scope="col">
                    OI
                  </th>
                  <th className="pb-1 font-medium" scope="col">
                    Leg
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const xoHref =
                    portfolioId && isValidXoptionsUnderlyingSymbol(r.symbol)
                      ? buildXoptionsStrategyBuilderHref(portfolioId, r.symbol)
                      : null;
                  return (
                  <tr
                    key={`${r.symbol}-${r.contractType}-${r.strike}`}
                    className="border-t border-white/5 font-mono tabular-nums text-[var(--xf-text-100)]"
                  >
                    <td className="py-1 pr-1 align-middle">
                      {xoHref ? (
                        <Link href={xoHref} title={`Open ${r.symbol} in xOptions`}>
                          <PortfolioSymbolMark symbol={r.symbol} size={26} />
                        </Link>
                      ) : (
                        <PortfolioSymbolMark symbol={r.symbol} size={26} />
                      )}
                    </td>
                    <td className="py-1 pr-2 align-middle font-semibold">
                      {xoHref ? (
                        <Link
                          className="text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] underline-offset-2 hover:underline"
                          href={xoHref}
                          title={`Open ${r.symbol} in xOptions`}
                        >
                          {r.symbol}
                        </Link>
                      ) : (
                        r.symbol
                      )}
                    </td>
                    <td className="py-1 pr-2 align-middle text-[var(--xf-text-200)]">{formatSpotUsd(r.spot)}</td>
                    <td className={`py-1 pr-2 align-middle text-[0.7rem] font-semibold ${chgPctToneClass(r.changePercent)}`}>
                      {formatChgPct(r.changePercent)}
                    </td>
                    <td className="py-1 pr-2 align-middle text-[var(--xf-text-200)]">
                      {r.impliedVolatilityPercent.toFixed(0)}%
                    </td>
                    <td className="py-1 pr-2 align-middle text-[var(--xf-text-200)]">{formatOi(r.openInterest)}</td>
                    <td className="py-1 align-middle text-[var(--xf-text-300)]">
                      {r.contractType} {r.strike.toFixed(2)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {scanned > 0 ? (
            <p className="mb-0 mt-2 text-[0.58rem] text-[var(--xf-text-500)]">Scanned {scanned} watchlist symbol(s).</p>
          ) : null}
        </>
      )}
    </section>
  );
}
