"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ExternalLinkIcon } from "@/app/admin/ui/crud-icons";

type HotRow = {
  symbol: string;
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
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

type Props = {
  portfolioId: string | null;
};

export function PortfoliosWatchlistCompact({ portfolioId }: Props) {
  const [rows, setRows] = useState<HotRow[]>([]);
  const [scanned, setScanned] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/app-user/find-options/watchlist-hot?limit=5`, {
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const watchlistHref =
    portfolioId !== null
      ? `/watchlist?portfolioId=${encodeURIComponent(portfolioId)}`
      : "/watchlist";

  return (
    <section
      className="portfolios-watchlist-compact xf-noise-overlay rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3"
      id="portfolios-watchlist"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]">
            Watchlist
          </h2>
          <p className="mt-0.5 mb-0 text-[0.62rem] leading-snug text-[var(--xf-text-400)]">
            Top 5 by IV / OI (nearest expiry, watchlist symbols only)
          </p>
        </div>
        <Link
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-[var(--xf-bg-800)] px-2 py-1 text-xs font-medium text-[var(--xf-text-100)] hover:bg-[var(--xf-bg-700)]"
          href={watchlistHref}
          title="Open full watchlist: details, import/export, add and remove rows"
        >
          View &amp; manage
          <ExternalLinkIcon className="h-3 w-3 opacity-80" aria-hidden />
        </Link>
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
          <Link className="text-[var(--xf-gain-green)] underline hover:no-underline" href={watchlistHref}>
            Open watchlist
          </Link>{" "}
          to add tickers.
        </p>
      ) : (
        <>
          <div className="portfolios-watchlist-compact__scroll overflow-x-auto">
            <table className="portfolios-watchlist-compact__table min-w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--xf-text-300)]">
                  <th className="pb-1 pr-2 font-medium">Sym</th>
                  <th className="pb-1 pr-2 font-medium">IV</th>
                  <th className="pb-1 pr-2 font-medium">OI</th>
                  <th className="pb-1 font-medium">Leg</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.symbol}-${r.contractType}-${r.strike}`} className="border-t border-white/5 font-mono tabular-nums text-[var(--xf-text-100)]">
                    <td className="py-1 pr-2 font-semibold">{r.symbol}</td>
                    <td className="py-1 pr-2 text-[var(--xf-text-200)]">{r.impliedVolatilityPercent.toFixed(0)}%</td>
                    <td className="py-1 pr-2 text-[var(--xf-text-200)]">{formatOi(r.openInterest)}</td>
                    <td className="py-1 text-[var(--xf-text-300)]">
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
