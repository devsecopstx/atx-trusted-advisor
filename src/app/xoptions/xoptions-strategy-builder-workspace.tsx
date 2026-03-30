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

function mergedServerOutlook(ctx: ContextPayload | null): string {
  if (!ctx) return "";
  const desk = ctx.account.outlook ? String(ctx.account.outlook) : "";
  const book = ctx.bookOutlookText?.trim() ?? "";
  if (desk && book) return `${desk} · ${book}`;
  return desk || book || "";
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
  const [deskEditOpen, setDeskEditOpen] = useState(false);
  const [weeks, setWeeks] = useState(14);

  const [outlookOverride, setOutlookOverride] = useState("");
  const [riskOverride, setRiskOverride] = useState<"" | "conservative" | "balanced" | "growth">("");
  const [factorWeights, setFactorWeights] = useState<{ id: string; weight: number; label: string }[] | null>(null);

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
    if (!ctx) return;
    setFactorWeights(
      ctx.scoringFactors.map((f) => ({
        id: f.id,
        weight: f.weight,
        label: f.label
      }))
    );
  }, [ctx]);

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

  const effectiveOutlook = useMemo(() => {
    const o = outlookOverride.trim();
    if (o.length > 0) return o;
    return mergedServerOutlook(ctx);
  }, [ctx, outlookOverride]);

  const effectiveRisk = useMemo(() => {
    const r = riskOverride || ctx?.account.riskProfile || ctx?.bookRiskProfile || null;
    return riskLabel(r);
  }, [ctx, riskOverride]);

  const effectiveFactors = useMemo(() => factorWeights ?? [], [factorWeights]);

  const weightSum = useMemo(
    () => effectiveFactors.reduce((s, f) => s + f.weight, 0),
    [effectiveFactors]
  );
  const weightOk = Math.abs(weightSum - 1) < 0.02;

  const scoringSummaryCollapsed = useMemo(() => {
    if (effectiveFactors.length === 0) return "No scoring factors — defaults apply when missing.";
    return effectiveFactors.map((f) => `${f.label} (${(f.weight * 100).toFixed(0)}%)`).join(" · ");
  }, [effectiveFactors]);

  function resetDeskToPortfolio() {
    setOutlookOverride("");
    setRiskOverride("");
    if (ctx) {
      setFactorWeights(
        ctx.scoringFactors.map((f) => ({
          id: f.id,
          weight: f.weight,
          label: f.label
        }))
      );
    }
  }

  function updateFactorWeight(id: string, pct: number) {
    setFactorWeights((prev) => {
      const base = prev ?? [];
      return base.map((row) =>
        row.id === id ? { ...row, weight: Math.min(1, Math.max(0, pct / 100)) } : row
      );
    });
  }

  return (
    <div className="xoptions-workspace space-y-5 max-w-3xl">
      <header className="space-y-2">
        <p className="xoptions-workspace__eyebrow text-xs font-semibold uppercase tracking-[0.2em]">xoptions</p>
        <h1 className="xoptions-workspace__h1 text-xl font-bold tracking-tight md:text-2xl">Strategy builder</h1>
        <p className="xoptions-workspace__lead text-xs leading-relaxed md:text-sm">
          Uses your default portfolio, scoring factors, account desk, and watchlist. Select a symbol, outlook, risk, and
          scoring weights (expand to override), pick an expiration window (1, 2, or 4 weeks), then open the chain to
          filter and trade. Top holdings are ranked by value; hot watchlist picks are the top symbols with IV &gt; 70%
          and OI &gt; 100 on the nearest expiration slice.
        </p>
      </header>

      {ctxErr ? <p className="xoptions-alert">{ctxErr}</p> : null}

      <section className="xoptions-panel p-3" aria-label="Account, horizon, and desk context">
        <div className="xoptions-account-expiry-row">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="xoptions-workspace__label">Account</p>
                <p className="xoptions-workspace__stat text-base font-semibold md:text-lg">{ctx?.account.name ?? "—"}</p>
                <p className="xoptions-hint text-xs">{ctx?.portfolio?.name ?? "Default portfolio"}</p>
              </div>
              <div className="text-right text-xs xoptions-workspace__body sm:text-sm">
                <p className="line-clamp-2">
                  <span className="xoptions-inline-muted">Outlook </span>
                  <span className="xoptions-workspace__stat">{effectiveOutlook || "—"}</span>
                </p>
                <p>
                  <span className="xoptions-inline-muted">Risk </span>
                  <span className="xoptions-workspace__stat">{ctx ? effectiveRisk : "—"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="xoptions-expiry-col">
            <p className="xoptions-workspace__label mb-1.5">Target expiration</p>
            <div className="xoptions-choice-row">
              {WEEK_CHIPS.map((w) => (
                <button
                  key={w.days}
                  type="button"
                  className={`xoptions-choice ${weeks === w.days ? "xoptions-choice--active" : ""}`}
                  onClick={() => setWeeks(w.days)}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <p className="xoptions-hint mt-1.5 text-xs leading-snug">
              Chain: pick exp nearest ~{weeks} calendar days.
            </p>
          </div>
        </div>

        <p className="xoptions-hint mt-2 line-clamp-2 text-xs" aria-hidden={deskEditOpen}>
          <span className="opacity-80">Scoring · </span>
          {scoringSummaryCollapsed}
        </p>

        <button
          type="button"
          className="xoptions-desk-toggle mt-2"
          onClick={() => setDeskEditOpen((o) => !o)}
          aria-expanded={deskEditOpen}
        >
          <span>{deskEditOpen ? "Hide desk & scoring" : "Edit outlook, risk & scoring"}</span>
          <span aria-hidden className="xoptions-desk-toggle__chev">
            {deskEditOpen ? "▼" : "▶"}
          </span>
        </button>

        {deskEditOpen ? (
          <div className="xoptions-workspace__divider space-y-4">
            <div>
              <label className="xoptions-workspace__label block" htmlFor="xo-outlook">
                Outlook (overrides desk line for this session)
              </label>
              <textarea
                id="xo-outlook"
                className="crud-input mt-1"
                rows={3}
                placeholder={mergedServerOutlook(ctx) || "e.g. income · neutral"}
                value={outlookOverride}
                onChange={(e) => setOutlookOverride(e.target.value)}
              />
            </div>
            <div>
              <label className="xoptions-workspace__label block" htmlFor="xo-risk">
                Risk
              </label>
              <select
                id="xo-risk"
                className="crud-input mt-1 w-full max-w-xs"
                value={riskOverride}
                onChange={(e) =>
                  setRiskOverride(
                    e.target.value === ""
                      ? ""
                      : (e.target.value as "conservative" | "balanced" | "growth")
                  )
                }
              >
                <option value="">Use portfolio / account ({riskLabel(ctx?.account.riskProfile ?? ctx?.bookRiskProfile ?? null)})</option>
                <option value="conservative">Conservative</option>
                <option value="balanced">Balanced</option>
                <option value="growth">Growth</option>
              </select>
            </div>
            <div>
              <p className="xoptions-workspace__label">Scoring factor weights</p>
              <ul className="mt-2 space-y-2">
                {effectiveFactors.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 text-sm xoptions-workspace__body">
                    <span className="min-w-[8rem]">{f.label}</span>
                    <input
                      type="number"
                      className="crud-input w-20 font-mono"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(f.weight * 1000) / 10}
                      onChange={(e) => updateFactorWeight(f.id, Number(e.target.value))}
                      aria-label={`Weight percent for ${f.label}`}
                    />
                    <span className="xoptions-inline-muted">%</span>
                  </li>
                ))}
              </ul>
              <p className={`mt-2 text-xs ${weightOk ? "xoptions-hint" : "xoptions-warning"}`}>
                Weights sum to {(weightSum * 100).toFixed(1)}% — target 100% for a normalized composite (session-only;
                persist via Portfolio when wired).
              </p>
            </div>
            <button type="button" className="xoptions-text-link text-sm" onClick={resetDeskToPortfolio}>
              Reset to portfolio
            </button>
          </div>
        ) : null}
      </section>

      <section aria-label="Symbol">
        <p className="xoptions-workspace__label mb-1.5">Symbol</p>
        <input
          className="crud-input mb-3 max-w-xs font-mono uppercase"
          placeholder="Enter symbol (e.g. TSLA)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          aria-label="Underlying symbol"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium xoptions-workspace__stat">Top account holdings</p>
            <p className="xoptions-hint mb-2">By market value</p>
            <ul className="space-y-1 text-sm">
              {holdings.length === 0 ? (
                <li className="xoptions-hint">No stock positions found.</li>
              ) : (
                holdings.map((row) => (
                  <li key={row.symbol}>
                    <button type="button" className="xoptions-symbol-row" onClick={() => setSymbol(row.symbol)}>
                      <span className="xoptions-symbol-row__sym">{row.symbol}</span>
                      <span className="xoptions-symbol-row__meta">
                        {row.lastPrice != null ? `≈ $${row.lastPrice.toFixed(2)}` : ""}
                        <span className="ml-2">mv ${row.marketValue.toFixed(0)}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium xoptions-workspace__stat">Hot watchlist</p>
            <p className="xoptions-hint mb-2">Top matches: IV &gt; 70%, OI &gt; 100 (nearest exp)</p>
            <ul className="space-y-1 text-sm">
              {hot.length === 0 ? (
                <li className="xoptions-hint">
                  No symbols matched filters
                  {hotMeta ? ` (scanned ${hotMeta.scanned})` : ""}.
                </li>
              ) : (
                hot.map((row) => (
                  <li key={row.symbol}>
                    <button type="button" className="xoptions-symbol-row" onClick={() => setSymbol(row.symbol)}>
                      <span className="xoptions-symbol-row__sym">{row.symbol}</span>
                      <span className="xoptions-symbol-row__meta">
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

      <section className="xoptions-panel p-3" aria-label="Quote snapshot">
        <p className="xoptions-workspace__label">Selected symbol</p>
        {snapLoading ? (
          <p className="xoptions-hint mt-2">Loading quote…</p>
        ) : snapshot && symbol.trim() ? (
          <div className="mt-2 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="xoptions-inline-muted">Last</p>
              <p className="font-mono text-lg xoptions-workspace__stat">
                {snapshot.lastPrice != null ? snapshot.lastPrice.toFixed(2) : "—"}{" "}
                <span className="xoptions-inline-muted">{snapshot.currency ?? ""}</span>
              </p>
            </div>
            <div>
              <p className="xoptions-inline-muted">RSI (14d)</p>
              <p className="font-mono text-lg xoptions-workspace__stat">
                {snapshot.rsi14 != null ? snapshot.rsi14.toFixed(1) : "—"}
              </p>
              <p className="xoptions-hint">Daily closes · this symbol</p>
            </div>
          </div>
        ) : (
          <p className="xoptions-hint mt-2">Enter or pick a symbol for last price and RSI.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="xoptions-cta"
          href={
            symbol.trim()
              ? `/xstrategybuilder/strategy-options?symbol=${encodeURIComponent(symbol.trim())}`
              : "/xstrategybuilder/strategy-options"
          }
        >
          Open option chain
        </Link>
        <span className="xoptions-inline-muted">
          xStrategyBuilder ·{" "}
          <span className="xoptions-pricing-em" title="Cheapest xFinance on earth — pay only for what you use.">
            $2/hr
          </span>{" "}
          usage
        </span>
      </div>
    </div>
  );
}
