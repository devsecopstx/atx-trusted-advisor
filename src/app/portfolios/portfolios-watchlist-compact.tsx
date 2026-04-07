"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ExternalLinkIcon } from "@/app/admin/ui/crud-icons";

import type { PortfoliosWorkspaceDeskHints } from "./portfolios-workspace-client";

type HotRow = {
  symbol: string;
  spot: number | null;
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
};

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

type Props = {
  portfolioId: string | null;
  /** Server-prefetched desk context (Mongo watchlist + alerts + optional IBKR); hot IV/OI rows still load client-side. */
  deskHints?: PortfoliosWorkspaceDeskHints | null;
  /** Increment to re-fetch hot IV/OI rows after watchlist mutations elsewhere on the page. */
  refreshKey?: number;
  /** When set, “View & manage watchlist” stays on the current desk (e.g. portfolio inline tab). */
  onOpenFullWatchlist?: () => void;
};

export function PortfoliosWatchlistCompact({
  portfolioId,
  deskHints = null,
  refreshKey = 0,
  onOpenFullWatchlist
}: Props) {
  const [rows, setRows] = useState<HotRow[]>([]);
  const [scanned, setScanned] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: "5" });
      if (portfolioId) {
        qs.set("portfolioId", portfolioId);
      }
      const res = await fetch(`/api/app-user/find-options/watchlist-hot?${qs.toString()}`, {
        credentials: "include"
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { rows?: HotRow[]; scanned?: number };
        error?: string;
      };
      if (!res.ok) {
        setErr(body.error ?? "Could not load watchlist scan");
        setRows([]);
        setScanned(0);
        return;
      }
      const r = body.data?.rows ?? [];
      setRows(
        r.filter(
          (x): x is HotRow =>
            typeof x?.symbol === "string" &&
            (x.spot === null || x.spot === undefined || typeof x.spot === "number") &&
            typeof x?.impliedVolatilityPercent === "number" &&
            typeof x?.openInterest === "number" &&
            typeof x?.strike === "number" &&
            (x.contractType === "call" || x.contractType === "put")
        )
      );
      setScanned(typeof body.data?.scanned === "number" ? body.data.scanned : 0);
    } catch {
      setErr("Network error");
      setRows([]);
      setScanned(0);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

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

      {err ? (
        <p className="text-xs text-red-300" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-[var(--xf-text-300)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs leading-relaxed text-[var(--xf-text-400)]">
          No symbols met the IV/OI scan yet, or your watchlist is empty.{" "}
          {onOpenFullWatchlist ? (
            <button
              className="text-[var(--xf-gain-green)] underline hover:no-underline"
              type="button"
              onClick={onOpenFullWatchlist}
            >
              Open watchlist
            </button>
          ) : (
            <Link className="text-[var(--xf-gain-green)] underline hover:no-underline" href={watchlistHref}>
              Open watchlist
            </Link>
          )}{" "}
          to add tickers.
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
                {rows.map((r) => (
                  <tr
                    key={`${r.symbol}-${r.contractType}-${r.strike}`}
                    className="border-t border-white/5 font-mono tabular-nums text-[var(--xf-text-100)]"
                  >
                    <td className="py-1 pr-1 align-middle">
                      <div
                        aria-hidden
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] text-[0.6rem] font-bold text-[var(--xf-text-200)]"
                      >
                        {r.symbol.slice(0, 2)}
                      </div>
                    </td>
                    <td className="py-1 pr-2 align-middle font-semibold">{r.symbol}</td>
                    <td className="py-1 pr-2 align-middle text-[var(--xf-text-200)]">{formatSpotUsd(r.spot)}</td>
                    <td className="py-1 pr-2 align-middle text-[var(--xf-text-200)]">
                      {r.impliedVolatilityPercent.toFixed(0)}%
                    </td>
                    <td className="py-1 pr-2 align-middle text-[var(--xf-text-200)]">{formatOi(r.openInterest)}</td>
                    <td className="py-1 align-middle text-[var(--xf-text-300)]">
                      {r.contractType} {r.strike.toFixed(2)}
                    </td>
                  </tr>
                ))}
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
