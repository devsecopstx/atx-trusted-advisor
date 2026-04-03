"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { NearestExpiryOptionsGlance } from "@/modules/find-options/options-hot-scan";

import type { PortfoliosHeroTopHolding } from "./portfolios-hero-left-column";

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
  topHoldings: PortfoliosHeroTopHolding[];
  holdingsKey: string;
};

export function PortfoliosMiniHoldingsGlance({ topHoldings, holdingsKey }: Props) {
  const [optionsGlance, setOptionsGlance] = useState<
    { symbol: string; highlight: NearestExpiryOptionsGlance | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const primarySymbol = topHoldings[0]?.symbol;

  const key = useMemo(
    () => holdingsKey || topHoldings.slice(0, 2).map((h) => h.symbol).join(","),
    [holdingsKey, topHoldings]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = key ? `?holdings=${encodeURIComponent(key)}` : "";
        const res = await fetch(`/api/market/workspace-pulse${qs}`, { credentials: "include" });
        const body = (await res.json()) as {
          data?: { optionsGlance?: { symbol: string; highlight: NearestExpiryOptionsGlance | null }[] };
        };
        if (!cancelled && body.data?.optionsGlance) {
          setOptionsGlance(body.data.optionsGlance);
        }
      } catch {
        if (!cancelled) {
          setOptionsGlance([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    const t = setInterval(() => void load(), 180_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [key]);

  return (
    <div className="portfolios-mini-holdings xf-noise-overlay mt-3 rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]">
          Top book &amp; IV/OI
        </h3>
        {primarySymbol ? (
          <Link
            className="text-xs text-[var(--xf-gain-green)] hover:underline"
            href={`/xoptions/full-chain?symbol=${encodeURIComponent(primarySymbol)}`}
          >
            Chain
          </Link>
        ) : null}
      </div>
      <p className="mb-1 text-[0.65rem] text-[var(--xf-text-300)]">Largest stock book (workspace)</p>
      {topHoldings.length === 0 ? (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">Add positions from Portfolio.</p>
      ) : (
        <ul className="m-0 list-none space-y-0.5 p-0">
          {topHoldings.map((h) => (
            <li
              key={h.symbol}
              className="flex justify-between gap-2 font-mono text-xs tabular-nums text-[var(--xf-text-100)]"
            >
              <span>{h.symbol}</span>
              <span className="text-[var(--xf-text-300)]">{formatUsdWhole(h.bookUsd)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mb-1 mt-2 text-[0.65rem] text-[var(--xf-text-300)]">High IV / OI · nearest expiry</p>
      {loading && optionsGlance.length === 0 ? (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">Loading…</p>
      ) : optionsGlance.length === 0 ? (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">—</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0 font-mono text-[0.7rem]">
          {optionsGlance.map((row) => (
            <li key={row.symbol}>
              {row.highlight ? (
                <>
                  <span className="text-[var(--xf-text-100)]">{row.symbol}</span>{" "}
                  <span className="text-[var(--xf-text-300)]">
                    {row.highlight.contractType} {row.highlight.strike} · IV {row.highlight.impliedVolatilityPercent}% ·
                    OI {formatOi(row.highlight.openInterest)}
                  </span>
                </>
              ) : (
                <span className="text-[var(--xf-text-300)]">{row.symbol} — no chain data</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
