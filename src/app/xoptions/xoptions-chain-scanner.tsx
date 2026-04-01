"use client";

import { useCallback, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import {
    addCalendarDaysUtc,
    horizonShortLabel,
    otmPercentCall,
    otmPercentPut,
    pickExpirationOnOrAfter,
    spreadMetrics,
    spreadQuality
} from "@/lib/xoptions/xoptions-chain-helpers";

type ChainLeg = {
  last_quote: { bid: number; ask: number };
  open_interest?: number;
  volume?: number;
} | null;

function openInterest(leg: ChainLeg): number {
  if (!leg) {
    return 0;
  }
  const oi = leg.open_interest;
  return typeof oi === "number" && Number.isFinite(oi) ? oi : 0;
}

type ChainRow = {
  strike: number;
  call: ChainLeg;
  put: ChainLeg;
};

type ChainPayload = {
  underlying: string;
  expiration: string;
  requestedExpiration: string;
  stockPrice: number;
  dataSource: string;
  note?: string;
  optionChain: ChainRow[];
  error?: string;
};

type ExpirationsPayload = { underlying: string; expirationDates: string[]; error?: string };

function legOi(leg: ChainLeg): number {
  return openInterest(leg);
}

function filterChainRows(rows: ChainRow[]): { rows: ChainRow[]; usedOiFilter: boolean } {
  const filtered = rows.filter((r) => legOi(r.call) > 0 || legOi(r.put) > 0);
  if (filtered.length > 0) {
    return { rows: filtered, usedOiFilter: true };
  }
  return { rows, usedOiFilter: false };
}

type XoptionsChainScannerProps = {
  symbol: string;
  weeks: number | null;
  /** Anchor for GET /api/strategy-options strike (quote or 0). */
  lastPrice: number | null;
};

export function XoptionsChainScanner({ symbol, weeks, lastPrice }: XoptionsChainScannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chain, setChain] = useState<ChainPayload | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [resolvedMeta, setResolvedMeta] = useState<{
    targetDate: string;
    expiration: string;
    horizon: string;
  } | null>(null);

  const loadChain = useCallback(async () => {
    const u = symbol.trim().toUpperCase();
    if (!u || weeks === null) {
      setError("Enter a symbol and select a horizon (1w / 2w / 4w).");
      return;
    }
    setLoading(true);
    setError(null);
    setChain(null);
    setResolvedMeta(null);
    try {
      const expRes = await fetch(
        `/api/strategy-options/expirations?underlying=${encodeURIComponent(u)}`,
        { credentials: "include" }
      );
      const expJson = (await expRes.json()) as ExpirationsPayload;
      if (!expRes.ok) {
        throw new Error(expJson.error ?? "Could not load expirations.");
      }
      const dates = expJson.expirationDates ?? [];
      if (dates.length === 0) {
        throw new Error("No option expirations returned for this symbol.");
      }
      const now = new Date();
      const target = addCalendarDaysUtc(now, weeks);
      const picked = pickExpirationOnOrAfter(dates, target);
      if (!picked) {
        throw new Error(
          "No expiration on or after the target date for this horizon — try another horizon or symbol."
        );
      }
      const strikeParam =
        lastPrice != null && Number.isFinite(lastPrice) && lastPrice > 0
          ? String(lastPrice)
          : "0";
      const qs = new URLSearchParams({
        underlying: u,
        expiration: picked,
        strike: strikeParam
      });
      const chainRes = await fetch(`/api/strategy-options?${qs.toString()}`, {
        credentials: "include"
      });
      const payload = (await chainRes.json()) as ChainPayload & { error?: string };
      if (!chainRes.ok) {
        throw new Error(payload.error ?? "Could not load option chain.");
      }
      setChain(payload);
      setResolvedMeta({
        targetDate: target.toISOString().slice(0, 10),
        expiration: payload.expiration,
        horizon: horizonShortLabel(weeks)
      });
      setLoadedAt(new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chain load failed.");
    } finally {
      setLoading(false);
    }
  }, [symbol, weeks, lastPrice]);

  const copyCsv = useCallback(() => {
    if (!chain || !resolvedMeta) {
      return;
    }
    const u = chain.stockPrice;
    const lines: string[] = [
      `underlying,${chain.underlying}`,
      `expiration,${chain.expiration}`,
      `horizon,${resolvedMeta.horizon}`,
      `spot,${u}`,
      "",
      "side,strike,bid,ask,mid,spread,spread_pct_mid,otm_pct,oi"
    ];
    const { rows } = filterChainRows(chain.optionChain);
    for (const r of rows) {
      for (const side of ["call", "put"] as const) {
        const leg = r[side];
        if (!leg) {
          continue;
        }
        const bid = leg.last_quote.bid;
        const ask = leg.last_quote.ask;
        const { abs, pctMid } = spreadMetrics(bid, ask);
        const mid = (bid + ask) / 2;
        const otm =
          side === "call" ? otmPercentCall(r.strike, u) : otmPercentPut(r.strike, u);
        lines.push(
          [
            side,
            r.strike,
            bid,
            ask,
            mid,
            abs,
            pctMid ?? "",
            otm.toFixed(2),
            legOi(leg)
          ].join(",")
        );
      }
    }
    void navigator.clipboard.writeText(lines.join("\n"));
  }, [chain, resolvedMeta]);

  const CHAIN_DISPLAY_MAX = 80;

  const canLoad = symbol.trim().length > 0 && weeks !== null;
  const filtered = chain
    ? filterChainRows(chain.optionChain)
    : { rows: [] as ChainRow[], usedOiFilter: false };
  const displayRows = filtered.rows.slice(0, CHAIN_DISPLAY_MAX);
  const truncated =
    chain !== null && filtered.rows.length > CHAIN_DISPLAY_MAX;

  return (
    <section
      className="xoptions-chain-scanner"
      aria-label="Option chain scanner"
    >
      <p className="xoptions-mid-three__label">Option chain scanner</p>
      <p className="xoptions-hint mb-2 text-xs">
        Loads the closest expiration on or after your horizon (today + 7 / 14 / 28 days). Uses the
        same BFF as xStrategyBuilder. Refresh is manual.
      </p>
      <div className="xoptions-chain-scanner__toolbar mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="cta cta-secondary inline-flex items-center gap-1.5"
          disabled={loading || !canLoad}
          onClick={() => void loadChain()}
          aria-label={loading ? "Loading option chain" : "Load option chain"}
        >
          <RefreshIcon className="crud-icon" />
          {loading ? "Loading…" : "Load chain"}
        </button>
        {chain && resolvedMeta ? (
          <button
            type="button"
            className="xoptions-text-link text-xs"
            onClick={() => copyCsv()}
          >
            Copy table CSV
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="xoptions-alert mb-2" role="alert">
          {error}
        </p>
      ) : null}

      {chain && resolvedMeta ? (
        <div className="xoptions-chain-scanner__panel">
          <div className="xoptions-chain-scanner__meta">
            <p className="xoptions-chain-scanner__headline">
              {chain.underlying} · spot {chain.stockPrice.toFixed(2)}
              {loadedAt ? (
                <span className="xoptions-chain-scanner__loaded"> · loaded {loadedAt}</span>
              ) : null}
            </p>
            <p className="xoptions-chain-scanner__line">
              Expiration <span className="font-mono">{chain.expiration}</span> (closest to{" "}
              {resolvedMeta.horizon} target {resolvedMeta.targetDate})
            </p>
            <p className="xoptions-chain-scanner__line">
              Source: <em>{chain.dataSource}</em>
              {chain.note ? <span className="xoptions-chain-scanner__note"> · {chain.note}</span> : null}
            </p>
            {!filtered.usedOiFilter && chain.optionChain.length > 0 ? (
              <p className="xoptions-chain-scanner__warn">
                No strikes with OI &gt; 0 — showing full chain.
              </p>
            ) : null}
            {truncated ? (
              <p className="xoptions-chain-scanner__warn">
                Showing first {CHAIN_DISPLAY_MAX} strikes ({filtered.rows.length} total).
              </p>
            ) : null}
          </div>

          <div className="xoptions-chain-scanner__tables grid gap-4 md:grid-cols-2">
            <div className="min-w-0 overflow-x-auto">
              <p className="xoptions-chain-scanner__table-title mb-1">Calls</p>
              <table className="xoptions-chain-table w-full min-w-[20rem] border-collapse text-left text-[0.6875rem]">
                <thead>
                  <tr className="xoptions-chain-table__head">
                    <th className="py-1 pr-2 font-semibold">Strike</th>
                    <th className="py-1 pr-2 font-semibold">Bid</th>
                    <th className="py-1 pr-2 font-semibold">Ask</th>
                    <th className="py-1 pr-2 font-semibold">Mid</th>
                    <th className="py-1 pr-2 font-semibold">Spread</th>
                    <th className="py-1 pr-2 font-semibold">%</th>
                    <th className="py-1 pr-2 font-semibold">OTM%</th>
                    <th className="py-1 font-semibold">OI</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <ChainRowCall
                      key={`c-${row.strike}`}
                      row={row}
                      underlying={chain.stockPrice}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="min-w-0 overflow-x-auto">
              <p className="xoptions-chain-scanner__table-title mb-1">Puts</p>
              <table className="xoptions-chain-table w-full min-w-[20rem] border-collapse text-left text-[0.6875rem]">
                <thead>
                  <tr className="xoptions-chain-table__head">
                    <th className="py-1 pr-2 font-semibold">Strike</th>
                    <th className="py-1 pr-2 font-semibold">Bid</th>
                    <th className="py-1 pr-2 font-semibold">Ask</th>
                    <th className="py-1 pr-2 font-semibold">Mid</th>
                    <th className="py-1 pr-2 font-semibold">Spread</th>
                    <th className="py-1 pr-2 font-semibold">%</th>
                    <th className="py-1 pr-2 font-semibold">OTM%</th>
                    <th className="py-1 font-semibold">OI</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <ChainRowPut
                      key={`p-${row.strike}`}
                      row={row}
                      underlying={chain.stockPrice}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="xoptions-chain-scanner__disclaimer">
            For informational purposes only. Options trading involves substantial risk of loss and is
            not suitable for all investors. Quotes may be delayed; not financial advice.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function ChainRowCall({ row, underlying }: { row: ChainRow; underlying: number }) {
  const leg = row.call;
  if (!leg) {
    return (
      <tr className="xoptions-chain-table__row">
        <td className="py-0.5 font-mono">{row.strike}</td>
        <td colSpan={7} className="py-0.5 xoptions-chain-table__empty">
          —
        </td>
      </tr>
    );
  }
  return (
    <LegRow strike={row.strike} leg={leg} otm={otmPercentCall(row.strike, underlying)} />
  );
}

function ChainRowPut({ row, underlying }: { row: ChainRow; underlying: number }) {
  const leg = row.put;
  if (!leg) {
    return (
      <tr className="xoptions-chain-table__row">
        <td className="py-0.5 font-mono">{row.strike}</td>
        <td colSpan={7} className="py-0.5 xoptions-chain-table__empty">
          —
        </td>
      </tr>
    );
  }
  return (
    <LegRow strike={row.strike} leg={leg} otm={otmPercentPut(row.strike, underlying)} />
  );
}

function LegRow({
  strike,
  leg,
  otm
}: {
  strike: number;
  leg: ChainLeg;
  otm: number;
}) {
  if (!leg) {
    return null;
  }
  const bid = leg.last_quote.bid;
  const ask = leg.last_quote.ask;
  const { abs, pctMid } = spreadMetrics(bid, ask);
  const mid = (bid + ask) / 2;
  const q = spreadQuality(abs, pctMid);
  const spreadClass =
    q === "ok"
      ? "xoptions-chain-spread--ok"
      : q === "mid"
        ? "xoptions-chain-spread--mid"
        : "xoptions-chain-spread--wide";
  const oi = legOi(leg);
  return (
    <tr className="xoptions-chain-table__row">
      <td className="py-0.5 pr-2 font-mono xoptions-chain-table__strike">{strike}</td>
      <td className="py-0.5 pr-2 font-mono">{bid.toFixed(2)}</td>
      <td className="py-0.5 pr-2 font-mono">{ask.toFixed(2)}</td>
      <td className="py-0.5 pr-2 font-mono">{mid.toFixed(2)}</td>
      <td className={`py-0.5 pr-2 font-mono ${spreadClass}`}>{abs.toFixed(2)}</td>
      <td className={`py-0.5 pr-2 font-mono ${spreadClass}`}>
        {pctMid != null ? pctMid.toFixed(1) : "—"}
      </td>
      <td className="py-0.5 pr-2 font-mono">{otm.toFixed(1)}</td>
      <td className="py-0.5 font-mono">{oi.toLocaleString()}</td>
    </tr>
  );
}
