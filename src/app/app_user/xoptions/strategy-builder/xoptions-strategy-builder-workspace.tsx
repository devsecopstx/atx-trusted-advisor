"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ScoringFactorRow = {
  id: string;
  weight: number;
  label: string;
  description: string;
  normalization: string;
};

type ContextPayload = {
  portfolio: { id: string; name: string } | null;
  account: {
    id: string | null;
    name: string;
    riskProfile: "conservative" | "balanced" | "growth" | null;
    outlook: string | null;
  };
  bookOutlookText: string | null;
  bookRiskProfile: "conservative" | "balanced" | "growth" | null;
  scoringFactors: ScoringFactorRow[];
};

type HoldingRow = {
  symbol: string;
  marketValue: number;
  shares: number;
  lastPrice: number | null;
};

type HotRow = {
  symbol: string;
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
};

type SnapshotPayload = {
  symbol: string;
  lastPrice: number | null;
  rsi14: number | null;
  currency: string | null;
};

const WEEK_CHIPS: { label: string; days: number }[] = [
  { label: "1 wk", days: 7 },
  { label: "2 wk", days: 14 },
  { label: "4 wk", days: 28 }
];

function riskLabel(r: ContextPayload["account"]["riskProfile"]): string {
  if (r === "conservative") return "Conservative";
  if (r === "growth") return "Growth";
  if (r === "balanced") return "Balanced";
  return "—";
}

export function XoptionsStrategyBuilderWorkspace() {
  const [ctx, setCtx] = useState<ContextPayload | null>(null);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [hot, setHot] = useState<HotRow[]>([]);
  const [hotMeta, setHotMeta] = useState<{ scanned: number } | null>(null);
  const [symbol, setSymbol] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const [weeks, setWeeks] = useState(14);

  const loadContext = useCallback(async () => {
    setCtxErr(null);
    const res = await fetch("/api/app-user/find-options/context", { credentials: "include" });
    if (!res.ok) {
      setCtxErr("Could not load portfolio context.");
      return;
    }
    const json = (await res.json()) as { data: ContextPayload };
    setCtx(json.data);
  }, []);

  const loadLists = useCallback(async () => {
    const [h, w] = await Promise.all([
      fetch("/api/app-user/find-options/top-holdings?limit=12", { credentials: "include" }),
      fetch("/api/app-user/find-options/watchlist-hot?limit=3", { credentials: "include" })
    ]);
    if (h.ok) {
      const j = (await h.json()) as { data: { holdings: HoldingRow[] } };
      setHoldings(j.data?.holdings ?? []);
    }
    if (w.ok) {
      const j = (await w.json()) as { data: { rows: HotRow[]; scanned: number } };
      setHot(j.data?.rows ?? []);
      setHotMeta({ scanned: j.data?.scanned ?? 0 });
    }
  }, []);

  useEffect(() => {
    void loadContext();
    void loadLists();
  }, [loadContext, loadLists]);

  useEffect(() => {
    const s = symbol.trim().toUpperCase();
    if (s.length < 1) {
      setSnapshot(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setSnapLoading(true);
        try {
          const res = await fetch(
            `/api/app-user/find-options/symbol-snapshot?symbol=${encodeURIComponent(s)}`,
            { credentials: "include" }
          );
          if (res.ok) {
            const json = (await res.json()) as { data: SnapshotPayload };
            setSnapshot(json.data);
          } else {
            setSnapshot(null);
          }
        } finally {
          setSnapLoading(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [symbol]);

  const outlookLine = useMemo(() => {
    if (!ctx) return "";
    const desk = ctx.account.outlook ? String(ctx.account.outlook) : "";
    const book = ctx.bookOutlookText?.trim() ?? "";
    if (desk && book) return `${desk} · ${book}`;
    return desk || book || "—";
  }, [ctx]);

  return (
    <div className="xsb-strategy-builder space-y-8 max-w-3xl">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--xf-gain-green,#39ff14)]">
          xoptions · strategy builder
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Find option chains with your book</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Select a symbol, confirm desk outlook and scoring weights, choose a horizon (1–4 weeks), then open the live
          Yahoo-backed chain in xStrategyBuilder. Top holdings and hot watchlist names are loaded from your default
          portfolio and watchlist.
        </p>
      </header>

      {ctxErr ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {ctxErr}
        </p>
      ) : null}

      <section
        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
        aria-label="Account and desk context"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Account</p>
            <p className="text-lg font-semibold text-white">{ctx?.account.name ?? "—"}</p>
            <p className="text-xs text-slate-500">{ctx?.portfolio?.name ?? "Default portfolio"}</p>
          </div>
          <div className="text-right text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Outlook </span>
              {outlookLine}
            </p>
            <p>
              <span className="text-slate-500">Risk </span>
              {ctx ? riskLabel(ctx.account.riskProfile ?? ctx.bookRiskProfile) : "—"}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
          onClick={() => setDeskOpen((o) => !o)}
          aria-expanded={deskOpen}
        >
          <span>Scoring factors (from portfolio)</span>
          <span aria-hidden className="text-slate-500">
            {deskOpen ? "▼" : "▶"}
          </span>
        </button>
        {deskOpen ? (
          <ul className="mt-2 space-y-2 text-sm text-slate-400">
            {(ctx?.scoringFactors ?? []).map((f) => (
              <li key={f.id} className="flex justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
                <span>
                  <span className="font-medium text-slate-200">{f.label}</span> — {f.description}
                </span>
                <span className="shrink-0 tabular-nums text-emerald-300/90">{(f.weight * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">
            {(ctx?.scoringFactors ?? [])
              .map((f) => `${f.label} (${(f.weight * 100).toFixed(0)}%)`)
              .join(" · ") || "No scoring factors yet — defaults apply when missing."}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Overrides for outlook, risk, and weights stay client-side for this pass; persist via Portfolio when wired.
        </p>
      </section>

      <section aria-label="Horizon">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Target expiration window</p>
        <div className="flex flex-wrap gap-2">
          {WEEK_CHIPS.map((w) => (
            <button
              key={w.days}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm ${
                weeks === w.days
                  ? "border-[color:var(--xf-gain-green,#39ff14)] bg-emerald-500/10 text-emerald-200"
                  : "border-white/15 text-slate-300 hover:border-white/30"
              }`}
              onClick={() => setWeeks(w.days)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Use the closest listed expiration inside the chain UI (≈{weeks} calendar days).
        </p>
      </section>

      <section aria-label="Symbol">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Symbol</p>
        <input
          className="mb-4 w-full max-w-xs rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm uppercase text-white outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="e.g. TSLA"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          aria-label="Underlying symbol"
        />

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-200">Top account holdings</p>
            <ul className="space-y-1 text-sm">
              {holdings.length === 0 ? (
                <li className="text-slate-500">No stock positions found.</li>
              ) : (
                holdings.map((row) => (
                  <li key={row.symbol}>
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1.5 text-left text-emerald-300/90 hover:bg-white/5"
                      onClick={() => setSymbol(row.symbol)}
                    >
                      <span className="font-mono font-semibold">{row.symbol}</span>
                      <span className="ml-2 text-slate-500">
                        {row.lastPrice != null ? `≈ $${row.lastPrice.toFixed(2)}` : ""}
                        <span className="ml-2 text-slate-600">mv ${row.marketValue.toFixed(0)}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-200">Hot watchlist (IV &gt; 70%, OI &gt; 100)</p>
            <ul className="space-y-1 text-sm">
              {hot.length === 0 ? (
                <li className="text-slate-500">
                  No symbols matched filters
                  {hotMeta ? ` (scanned ${hotMeta.scanned})` : ""}.
                </li>
              ) : (
                hot.map((row) => (
                  <li key={row.symbol}>
                    <button
                      type="button"
                      className="w-full rounded-md px-2 py-1.5 text-left text-emerald-300/90 hover:bg-white/5"
                      onClick={() => setSymbol(row.symbol)}
                    >
                      <span className="font-mono font-semibold">{row.symbol}</span>
                      <span className="ml-2 text-slate-500">
                        IV {row.impliedVolatilityPercent.toFixed(1)}% · OI {row.openInterest.toLocaleString()} ·{" "}
                        {row.contractType} {row.strike}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4" aria-label="Quote snapshot">
        <p className="text-xs uppercase tracking-wide text-slate-500">Selected symbol</p>
        {snapLoading ? (
          <p className="mt-2 text-sm text-slate-400">Loading quote…</p>
        ) : snapshot && symbol.trim() ? (
          <div className="mt-2 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-slate-500">Last</p>
              <p className="font-mono text-lg text-white">
                {snapshot.lastPrice != null ? snapshot.lastPrice.toFixed(2) : "—"}{" "}
                <span className="text-slate-500">{snapshot.currency ?? ""}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-500">RSI (14d)</p>
              <p className="font-mono text-lg text-white">{snapshot.rsi14 != null ? snapshot.rsi14.toFixed(1) : "—"}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Enter or pick a symbol to load price and RSI.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex rounded-full border border-[color:var(--xf-gain-green,#39ff14)] bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
          href={
            symbol.trim()
              ? `/xstrategybuilder/strategy-options?symbol=${encodeURIComponent(symbol.trim())}`
              : "/xstrategybuilder/strategy-options"
          }
        >
          Open option chain
        </Link>
        <span className="text-xs text-slate-500">
          Uses xStrategyBuilder chain ·{" "}
          <span className="text-emerald-400/90" title="Cheapest xFinance on earth — pay only for what you use.">
            $2/hr
          </span>{" "}
          usage
        </span>
      </div>
    </div>
  );
}
