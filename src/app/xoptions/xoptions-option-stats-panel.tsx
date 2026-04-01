"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
    addCalendarDaysUtc,
    pickExpirationOnOrAfter
} from "@/lib/xoptions/xoptions-chain-helpers";

type ChainRow = {
  strike: number;
  call: { open_interest?: number; volume?: number } | null;
  put: { open_interest?: number; volume?: number } | null;
};

type ChainPayload = {
  underlying: string;
  expiration: string;
  optionChain: ChainRow[];
};

function sumLeg(
  rows: ChainRow[],
  side: "call" | "put",
  field: "open_interest" | "volume"
): number {
  let t = 0;
  for (const r of rows) {
    const leg = r[side];
    if (!leg) continue;
    const v = leg[field];
    if (typeof v === "number" && Number.isFinite(v)) {
      t += v;
    }
  }
  return t;
}

function RatioBar({ left, right, leftClass, rightClass }: { left: number; right: number; leftClass: string; rightClass: string }) {
  const total = left + right;
  const leftPct = total > 0 ? (left / total) * 100 : 50;
  return (
    <div className="xoptions-stats-ratio">
      <div className="xoptions-stats-ratio__track">
        <div className={leftClass} style={{ width: `${leftPct}%` }} />
        <div className={rightClass} style={{ width: `${100 - leftPct}%` }} />
      </div>
    </div>
  );
}

export function XoptionsOptionStatsPanel({
  symbol,
  weeks,
  lastPrice,
  active,
  enabled
}: {
  symbol: string;
  weeks: number | null;
  lastPrice: number | null;
  active: boolean;
  enabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ expiration: string; horizonLabel: string } | null>(null);
  const [totals, setTotals] = useState<{
    callOi: number;
    putOi: number;
    callVol: number;
    putVol: number;
  } | null>(null);

  const load = useCallback(async () => {
    const u = symbol.trim().toUpperCase();
    if (!u || weeks === null) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const expRes = await fetch(
        `/api/strategy-options/expirations?underlying=${encodeURIComponent(u)}`,
        { credentials: "include" }
      );
      const expJson = (await expRes.json()) as { expirationDates?: string[]; error?: string };
      if (!expRes.ok) {
        throw new Error(expJson.error ?? "Could not load expirations.");
      }
      const dates = expJson.expirationDates ?? [];
      if (dates.length === 0) {
        throw new Error("No expirations for this symbol.");
      }
      const target = addCalendarDaysUtc(new Date(), weeks);
      const picked = pickExpirationOnOrAfter(dates, target) ?? dates[dates.length - 1] ?? "";
      if (!picked) {
        throw new Error("Could not pick an expiration.");
      }
      const strikeParam =
        lastPrice != null && Number.isFinite(lastPrice) && lastPrice > 0 ? String(lastPrice) : "0";
      const qs = new URLSearchParams({
        underlying: u,
        expiration: picked,
        strike: strikeParam
      });
      const chainRes = await fetch(`/api/strategy-options?${qs.toString()}`, {
        credentials: "include"
      });
      const chain = (await chainRes.json()) as ChainPayload & { error?: string };
      if (!chainRes.ok) {
        throw new Error(chain.error ?? "Could not load chain.");
      }
      const rows = chain.optionChain ?? [];
      setMeta({
        expiration: chain.expiration,
        horizonLabel: `today + ${weeks}d`
      });
      setTotals({
        callOi: sumLeg(rows, "call", "open_interest"),
        putOi: sumLeg(rows, "put", "open_interest"),
        callVol: sumLeg(rows, "call", "volume"),
        putVol: sumLeg(rows, "put", "volume")
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stats failed.");
      setTotals(null);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, weeks, lastPrice]);

  useEffect(() => {
    if (!active || !enabled) {
      return;
    }
    void load();
  }, [active, enabled, load]);

  if (!enabled) {
    return (
      <div className="xoptions-full-chain__premium-gate rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-4">
        <p className="m-0 text-sm text-[var(--xf-text-200)]">
          Option statistics (flow breakdown, IV/HV-style gauges, block-trade feed) are included with{" "}
          <strong className="text-[var(--xf-gain-green)]">Premium</strong> or{" "}
          <strong className="text-[var(--xf-gain-green)]">Premium+</strong>.
        </p>
        <Link className="xoptions-text-link mt-3 inline-block text-sm" href="/account/billing">
          View billing & plans
        </Link>
      </div>
    );
  }

  if (!symbol.trim() || weeks === null) {
    return <p className="xoptions-hint text-sm">Set a symbol and horizon on the xOptions workspace to load statistics.</p>;
  }

  if (loading) {
    return <p className="xoptions-hint text-sm">Loading option statistics…</p>;
  }
  if (error) {
    return (
      <p className="xoptions-alert text-sm" role="alert">
        {error}
      </p>
    );
  }
  if (!totals || !meta) {
    return <p className="xoptions-hint text-sm">No statistics yet.</p>;
  }

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="xoptions-stats space-y-6">
      <div>
        <p className="xoptions-mid-three__label mb-1">Trade breakdown</p>
        <p className="xoptions-hint mb-3 text-xs">
          Aggregates across loaded expiration <span className="font-mono">{meta.expiration}</span> · horizon{" "}
          <span className="font-mono">{meta.horizonLabel}</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="xoptions-stats__card rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] p-3">
            <p className="m-0 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--xf-text-500)]">
              Open interest
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--xf-text-200)]">
              <span className="text-[var(--xf-gain-green)]">Calls {fmt(totals.callOi)}</span>
              {" · "}
              <span className="text-[color:var(--xf-chart-loss)]">Puts {fmt(totals.putOi)}</span>
            </p>
            <RatioBar
              left={totals.callOi}
              right={totals.putOi}
              leftClass="xoptions-stats-ratio__call"
              rightClass="xoptions-stats-ratio__put"
            />
          </div>
          <div className="xoptions-stats__card rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] p-3">
            <p className="m-0 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--xf-text-500)]">
              Volume (chain estimate)
            </p>
            <p className="mt-1 font-mono text-sm text-[var(--xf-text-200)]">
              <span className="text-[var(--xf-gain-green)]">Calls {fmt(totals.callVol)}</span>
              {" · "}
              <span className="text-[color:var(--xf-chart-loss)]">Puts {fmt(totals.putVol)}</span>
            </p>
            <RatioBar
              left={totals.callVol}
              right={totals.putVol}
              leftClass="xoptions-stats-ratio__call"
              rightClass="xoptions-stats-ratio__put"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="xoptions-mid-three__label mb-1">Volatility & tape (TBD)</p>
        <p className="xoptions-hint mb-2 text-xs">
          52-week IV/HV gauges and live block-trade tape require additional market data — placeholders below.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-dashed border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] p-4 text-center">
            <p className="m-0 text-xs text-[var(--xf-text-500)]">52-week IV (30d)</p>
            <p className="mt-2 font-mono text-lg text-[var(--xf-text-200)]">—</p>
          </div>
          <div className="rounded-md border border-dashed border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] p-4 text-center">
            <p className="m-0 text-xs text-[var(--xf-text-500)]">52-week HV (30d)</p>
            <p className="mt-2 font-mono text-lg text-[var(--xf-text-200)]">—</p>
          </div>
        </div>
      </div>

      <div>
        <p className="xoptions-mid-three__label mb-1">Today&apos;s largest prints (TBD)</p>
        <div className="overflow-x-auto rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)]">
          <table className="w-full min-w-[32rem] border-collapse text-left text-[0.6875rem]">
            <thead>
              <tr className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] text-[var(--xf-text-500)]">
                <th className="py-2 pr-2 font-semibold">Time</th>
                <th className="py-2 pr-2 font-semibold">Qty</th>
                <th className="py-2 pr-2 font-semibold">Contract</th>
                <th className="py-2 pr-2 font-semibold">Price</th>
                <th className="py-2 font-semibold">Exchange</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="py-6 px-3 text-center text-[var(--xf-text-500)]">
                  Block-trade feed not wired — TBD (paid data vendor).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
