"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { XoptionsChainScanner } from "@/app/xoptions/xoptions-chain-scanner";
import { XoptionsOptionStatsPanel } from "@/app/xoptions/xoptions-option-stats-panel";
import { XoptionsSymbolChartPanel } from "@/app/xoptions/xoptions-symbol-chart-panel";

type XoptionsEntitlementsPayload = {
  subscriptionPlan: "basic" | "premium" | "premium_plus";
  fullChainAnalytics: boolean;
};

type TabId = "chart" | "chain" | "stats";

type Snapshot = { symbol: string; lastPrice: number | null };

export function XoptionsFullChainWorkspace({
  initialSymbol,
  initialWeeks
}: {
  initialSymbol: string;
  initialWeeks: number;
}) {
  const [symbol] = useState(() => initialSymbol.trim().toUpperCase() || "TSLA");
  const [weeks] = useState(() => (Number.isFinite(initialWeeks) && initialWeeks > 0 ? initialWeeks : 14));
  const [tab, setTab] = useState<TabId>("chart");
  const [entitlements, setEntitlements] = useState<XoptionsEntitlementsPayload | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app-user/xoptions/entitlements", { credentials: "include" });
        const json = (await res.json()) as { data?: XoptionsEntitlementsPayload };
        if (cancelled) {
          return;
        }
        if (res.ok && json.data) {
          setEntitlements(json.data);
        } else {
          setEntitlements({ subscriptionPlan: "basic", fullChainAnalytics: false });
        }
      } catch {
        if (!cancelled) {
          setEntitlements({ subscriptionPlan: "basic", fullChainAnalytics: false });
        }
      }
      try {
        const res = await fetch(
          `/api/app-user/find-options/symbol-snapshot?symbol=${encodeURIComponent(symbol)}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as { data?: Snapshot };
        if (!cancelled && res.ok && json.data) {
          setSnapshot(json.data);
        }
      } catch {
        if (!cancelled) {
          setSnapshot({ symbol, lastPrice: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const full = entitlements?.fullChainAnalytics ?? false;
  const lastPrice = snapshot?.lastPrice ?? null;

  return (
    <div className="xoptions-full-chain max-w-[1100px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pb-3">
        <div>
          <Link className="xoptions-text-link text-sm" href="/xoptions">
            ← Back to xOptions
          </Link>
          <h1 className="mt-2 font-semibold text-[var(--xf-text-100)]">Full option chain workspace</h1>
          <p className="xoptions-hint mt-1 text-xs">
            <span className="font-mono">{symbol}</span>
            {snapshot?.lastPrice != null && Number.isFinite(snapshot.lastPrice) ? (
              <>
                {" "}
                · Last <span className="font-mono">{snapshot.lastPrice.toFixed(2)}</span>
              </>
            ) : null}
            {" "}
            · Horizon <span className="font-mono">{weeks}d</span>
          </p>
        </div>
        {entitlements ? (
          <p className="m-0 text-[0.625rem] uppercase tracking-wide text-[var(--xf-text-500)]">
            Plan: {entitlements.subscriptionPlan.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>

      <div className="xoptions-full-chain__tabs mb-4 flex flex-wrap gap-1 border-b border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)]">
        {(
          [
            ["chart", "Chart"],
            ["chain", "Option chain"],
            ["stats", "Option statistics"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`xoptions-full-chain__tab ${tab === id ? "xoptions-full-chain__tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "chart" ? (
        full ? (
          <XoptionsSymbolChartPanel symbol={symbol} enabled />
        ) : (
          <div className="xoptions-full-chain__premium-gate flex min-h-[14rem] flex-col items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)] px-4 py-8 text-center">
            <p className="m-0 max-w-md text-sm text-[var(--xf-text-200)]">
              Daily candles + volume (reference-style chart) are included with{" "}
              <strong className="text-[var(--xf-gain-green)]">Premium</strong> or{" "}
              <strong className="text-[var(--xf-gain-green)]">Premium+</strong>.
            </p>
            <Link className="xoptions-text-link mt-4 text-sm" href="/account/billing">
              View billing & plans
            </Link>
          </div>
        )
      ) : null}

      {tab === "chain" ? (
        <XoptionsChainScanner
          symbol={symbol}
          weeks={weeks}
          lastPrice={lastPrice}
          autoLoadOnMount
        />
      ) : null}

      {tab === "stats" ? (
        <XoptionsOptionStatsPanel
          symbol={symbol}
          weeks={weeks}
          lastPrice={lastPrice}
          active={tab === "stats"}
          enabled={full}
        />
      ) : null}
    </div>
  );
}
