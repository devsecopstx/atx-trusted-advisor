"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AddIcon } from "@/app/admin/ui/crud-icons";

type Quote = {
  price?: number;
  changePercent?: number;
} | null;

type Row = {
  symbol: string;
  entryPrice?: number;
  quote: Quote;
};

function formatChg(p: number | undefined): string {
  if (p === undefined || !Number.isFinite(p)) {
    return "—";
  }
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

function formatPx(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) {
    return "—";
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

type Props = {
  portfolioId: string | null;
};

export function PortfoliosWatchlistCompact({ portfolioId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!portfolioId) {
      setRows([]);
      setErr("No default portfolio.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/portfolios/${encodeURIComponent(portfolioId)}/watchlist?quotes=1`,
        { credentials: "include" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: {
          symbolsWithQuotes?: Array<{
            symbol: string;
            entryPrice?: number;
            quote: Quote;
          }>;
        };
        error?: string;
      };
      if (!res.ok) {
        setErr(body.error ?? "Could not load watchlist");
        setRows([]);
        return;
      }
      const raw = body.data?.symbolsWithQuotes ?? [];
      setRows(
        raw.map((r) => ({
          symbol: r.symbol,
          entryPrice: r.entryPrice,
          quote: r.quote ?? null
        }))
      );
    } catch {
      setErr("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]">
          Watchlist
        </h2>
        <Link
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-[var(--xf-bg-800)] px-2 py-1 text-xs text-[var(--xf-text-100)] hover:bg-[var(--xf-bg-700)]"
          href={watchlistHref}
        >
          <AddIcon className="crud-icon h-3.5 w-3.5" aria-hidden />
          Add / edit
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
        <p className="text-xs text-[var(--xf-text-300)]">No symbols. Add from full watchlist.</p>
      ) : (
        <div className="portfolios-watchlist-compact__scroll overflow-x-auto">
          <table className="portfolios-watchlist-compact__table min-w-full text-left text-xs">
            <thead>
              <tr className="text-[var(--xf-text-300)]">
                <th className="pb-1 pr-2 font-medium">Sym</th>
                <th className="pb-1 pr-2 font-medium">Last</th>
                <th className="pb-1 pr-2 font-medium">Chg</th>
                <th className="pb-1 pr-2 font-medium">IV</th>
                <th className="pb-1 pr-2 font-medium">Target</th>
                <th className="pb-1 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const q = r.quote;
                const last = q?.price;
                const chg = q?.changePercent;
                const chgCls =
                  (chg ?? 0) > 0
                    ? "text-[var(--xf-gain-green)]"
                    : (chg ?? 0) < 0
                      ? "text-red-300"
                      : "text-[var(--xf-text-300)]";
                return (
                  <tr key={r.symbol} className="border-t border-white/5 font-mono tabular-nums text-[var(--xf-text-100)]">
                    <td className="py-1 pr-2 font-semibold">{r.symbol}</td>
                    <td className="py-1 pr-2">{formatPx(last)}</td>
                    <td className={`py-1 pr-2 ${chgCls}`}>{formatChg(chg)}</td>
                    <td className="py-1 pr-2 text-[var(--xf-text-300)]">—</td>
                    <td className="py-1 pr-2">{formatPx(r.entryPrice)}</td>
                    <td className="py-1">
                      <Link
                        className="text-[var(--xf-gain-green)] hover:underline"
                        href={`/xoptions?symbol=${encodeURIComponent(r.symbol)}`}
                      >
                        Option
                      </Link>
                      {" · "}
                      <Link
                        className="text-[var(--xf-text-200)] hover:underline"
                        href={`/xoptions/full-chain?symbol=${encodeURIComponent(r.symbol)}`}
                      >
                        Chain
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
