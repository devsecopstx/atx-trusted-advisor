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
      <div className="xoptions-top-band">
        <header className="xoptions-workspace-header xoptions-workspace-header--compact">
          <p className="xoptions-workspace-header__eyebrow">xoptions</p>
          <h1 className="xoptions-workspace-header__title">Strategy builder</h1>
          <p className="xoptions-workspace-header__lead">
            Default portfolio, desk, and watchlist. Set outlook and scoring if needed, pick an expiration window, enter a
            symbol, then open the chain.
          </p>
        </header>

        <aside className="xoptions-top-band__glance min-w-0" aria-label="At a glance">
          <div className="xoptions-at-a-glance">
            <p className="xoptions-at-a-glance__head">At a glance</p>
            <div className="xoptions-at-a-glance__grid">
              <div className="min-w-0">
                <p className="xoptions-at-a-glance__title">Top holdings</p>
                <p className="xoptions-at-a-glance__sub">By market value</p>
                <ul className="xoptions-at-a-glance__list">
                  {holdings.length === 0 ? (
                    <li className="xoptions-at-a-glance__sub">No stock positions.</li>
                  ) : (
                    holdings.map((row) => (
                      <li key={row.symbol}>
                        <button
                          type="button"
                          className="xoptions-symbol-row xoptions-symbol-row--compact"
                          onClick={() => setSymbol(row.symbol)}
                        >
                          <span className="xoptions-symbol-row__sym">{row.symbol}</span>
                          <span className="xoptions-symbol-row__meta">
                            {row.lastPrice != null ? `≈ $${row.lastPrice.toFixed(2)}` : "—"}
                            <span className="opacity-90"> · mv ${row.marketValue.toFixed(0)}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="min-w-0">
                <p className="xoptions-at-a-glance__title">Hot watchlist</p>
                <p className="xoptions-at-a-glance__sub">IV &gt; 70%, OI &gt; 100 · nearest exp</p>
                <ul className="xoptions-at-a-glance__list">
                  {hot.length === 0 ? (
                    <li className="xoptions-at-a-glance__sub">
                      No matches{hotMeta ? ` (${hotMeta.scanned} scanned)` : ""}.
                    </li>
                  ) : (
                    hot.map((row) => (
                      <li key={row.symbol}>
                        <button
                          type="button"
                          className="xoptions-symbol-row xoptions-symbol-row--compact"
                          onClick={() => setSymbol(row.symbol)}
                        >
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
          </div>
        </aside>
      </div>

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

      <section className="xoptions-symbol-group" aria-label="Symbol and quote">
        <div className="xoptions-symbol-strip">
          <div className="xoptions-symbol-strip__field">
            <p className="xoptions-workspace__label mb-1">Symbol</p>
            <input
              className="crud-input font-mono text-sm uppercase"
              placeholder="e.g. TSLA"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              aria-label="Underlying symbol"
            />
          </div>
          <div className="xoptions-symbol-quote-inline pb-0.5" role="status" aria-live="polite">
            {symbol.trim().length === 0 ? (
              <span className="xoptions-hint text-xs">Last · RSI</span>
            ) : snapLoading ? (
              <span className="xoptions-hint text-xs">Loading…</span>
            ) : snapshot ? (
              <>
                <span className="xoptions-symbol-quote-inline__muted">Last </span>
                <span className="xoptions-symbol-quote-inline__stat">
                  {snapshot.lastPrice != null ? snapshot.lastPrice.toFixed(2) : "—"}
                </span>
                {snapshot.currency ? (
                  <span className="xoptions-symbol-quote-inline__muted"> {snapshot.currency}</span>
                ) : null}
                <span className="xoptions-symbol-quote-inline__muted"> · RSI </span>
                <span className="xoptions-symbol-quote-inline__stat">
                  {snapshot.rsi14 != null ? snapshot.rsi14.toFixed(1) : "—"}
                </span>
              </>
            ) : (
              <span className="xoptions-hint text-xs">No quote</span>
            )}
          </div>
        </div>
      </section>

      <div>
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
      </div>
    </div>
  );
}
