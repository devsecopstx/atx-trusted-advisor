"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DESK_OUTLOOK_LABELS,
  DESK_RISK_DISPLAY_LABELS
} from "@/modules/core-admin/desk-fields";
import type { AccountOutlook } from "@/modules/core-admin/types";

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
    outlook: AccountOutlook | null;
  };
  bookOutlook: AccountOutlook | null;
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

const MOVE_PCTS = [5, 10, 15] as const;

function riskLabel(r: ContextPayload["account"]["riskProfile"] | null | undefined): string {
  if (r === "conservative" || r === "balanced" || r === "growth") {
    return DESK_RISK_DISPLAY_LABELS[r];
  }
  return "—";
}

function outlookLabel(o: AccountOutlook | null | undefined): string {
  if (o === "bullish" || o === "neutral" || o === "bearish") {
    return DESK_OUTLOOK_LABELS[o];
  }
  return "—";
}

function mergedOutlookLabels(ctx: ContextPayload | null): string {
  if (!ctx) return "";
  const la = outlookLabel(ctx.account.outlook);
  const lb = outlookLabel(ctx.bookOutlook);
  if (la !== "—" && lb !== "—" && la !== lb) {
    return `${la} · ${lb}`;
  }
  if (la !== "—") {
    return la;
  }
  if (lb !== "—") {
    return lb;
  }
  return "";
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
  const [weeks, setWeeks] = useState(14);

  const [outlookOverride, setOutlookOverride] = useState<"" | AccountOutlook>("");
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
    if (outlookOverride !== "") {
      return outlookLabel(outlookOverride);
    }
    return mergedOutlookLabels(ctx);
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

  function resetWeightsToPortfolio() {
    if (!ctx) return;
    setFactorWeights(
      ctx.scoringFactors.map((f) => ({
        id: f.id,
        weight: f.weight,
        label: f.label
      }))
    );
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
    <div className="xoptions-workspace space-y-4 max-w-3xl">
      <p className="xoptions-page-kicker">xoptions · Strategy builder</p>

      <section className="xoptions-top-option-header" aria-label="Account, target horizon, and at a glance">
        <div className="xoptions-top-option-header__col xoptions-top-option-header__col--account min-w-0">
          <p className="xoptions-top-option-header__label">Account</p>
          <p className="xoptions-top-option-header__stat">{ctx?.account.name ?? "—"}</p>
          <p className="xoptions-top-option-header__hint">{ctx?.portfolio?.name ?? "Default portfolio"}</p>
          <div className="xoptions-top-option-header__desk">
            <p className="xoptions-top-option-header__desk-line line-clamp-2">
              <span className="xoptions-inline-muted">Outlook </span>
              {effectiveOutlook || "—"}
            </p>
            <p className="xoptions-top-option-header__desk-line">
              <span className="xoptions-inline-muted">Risk </span>
              {ctx ? effectiveRisk : "—"}
            </p>
          </div>
        </div>

        <div className="xoptions-top-option-header__col min-w-0">
          <p className="xoptions-top-option-header__label">Target expiration</p>
          <div className="xoptions-top-option-header__chips">
            {WEEK_CHIPS.map((w) => (
              <button
                key={w.days}
                type="button"
                className={`xoptions-choice xoptions-choice--header ${weeks === w.days ? "xoptions-choice--active" : ""}`}
                onClick={() => setWeeks(w.days)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <p className="xoptions-top-option-header__hint">~{weeks}d in chain</p>
        </div>

        <aside className="xoptions-top-option-header__col xoptions-top-option-header__col--glance min-w-0" aria-label="At a glance">
          <div className="xoptions-at-a-glance xoptions-at-a-glance--header">
            <p className="xoptions-at-a-glance__head">At a glance</p>
            <div className="xoptions-at-a-glance__grid">
              <div className="min-w-0">
                <p className="xoptions-at-a-glance__title">Holdings</p>
                <p className="xoptions-at-a-glance__sub">By value</p>
                <ul className="xoptions-at-a-glance__list">
                  {holdings.length === 0 ? (
                    <li className="xoptions-at-a-glance__sub">None.</li>
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
                            {row.lastPrice != null ? `$${row.lastPrice.toFixed(2)}` : "—"} · ${row.marketValue.toFixed(0)}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="min-w-0">
                <p className="xoptions-at-a-glance__title">Hot list</p>
                <p className="xoptions-at-a-glance__sub">IV/OI</p>
                <ul className="xoptions-at-a-glance__list">
                  {hot.length === 0 ? (
                    <li className="xoptions-at-a-glance__sub">
                      —{hotMeta ? ` (${hotMeta.scanned})` : ""}
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
                            {row.impliedVolatilityPercent.toFixed(0)}% · {row.openInterest.toLocaleString()}
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
      </section>

      {ctxErr ? <p className="xoptions-alert">{ctxErr}</p> : null}

      <section className="xoptions-panel p-2.5" aria-label="Scoring, symbol, market, and price levels">
        <div className="xoptions-mid-three">
          <div className="xoptions-mid-three__col min-w-0">
            <p className="xoptions-mid-three__label" id="scoringFactors-label">
              Scoring factors
            </p>
            <details
              id="scoringFactors"
              className="xoptions-scoring-drop"
              aria-labelledby="scoringFactors-label"
            >
              <summary className="xoptions-scoring-drop__summary">
                <span className="xoptions-scoring-drop__summary-text">View / edit weights</span>
                <span className="xoptions-scoring-drop__chev" aria-hidden>
                  ▾
                </span>
              </summary>
              <div className="xoptions-scoring-drop__body">
                <ul className="xoptions-scoring-drop__factors">
                  {effectiveFactors.length === 0 ? (
                    <li className="xoptions-hint text-xs list-none">No factors — portfolio defaults apply.</li>
                  ) : (
                    effectiveFactors.map((f) => (
                      <li key={f.id} className="xoptions-scoring-drop__factor-row">
                        <span className="xoptions-scoring-drop__factor-label">{f.label}</span>
                        <input
                          type="number"
                          className="crud-input xoptions-scoring-drop__factor-input font-mono"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(f.weight * 1000) / 10}
                          onChange={(e) => updateFactorWeight(f.id, Number(e.target.value))}
                          aria-label={`Weight percent for ${f.label}`}
                        />
                        <span className="xoptions-inline-muted">%</span>
                      </li>
                    ))
                  )}
                </ul>
                <p className={`text-xs ${weightOk ? "xoptions-hint" : "xoptions-warning"}`}>
                  Sum {(weightSum * 100).toFixed(1)}% (target 100%)
                </p>
                <button type="button" className="xoptions-text-link text-xs" onClick={resetWeightsToPortfolio}>
                  Reset weights
                </button>
              </div>
            </details>
          </div>

          <div className="xoptions-mid-three__col min-w-0">
            <label className="xoptions-mid-three__label block" htmlFor="xo-symbol">
              Symbol
            </label>
            <input
              id="xo-symbol"
              className="crud-input mt-0.5 w-full max-w-[14rem] font-mono text-sm uppercase"
              placeholder="e.g. TSLA"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              aria-label="Underlying symbol"
            />
          </div>

          <div className="xoptions-mid-three__col xoptions-mid-three__col--quote min-w-0" role="status" aria-live="polite">
            <p className="xoptions-mid-three__label">Market</p>
            {symbol.trim().length === 0 ? (
              <p className="xoptions-mid-three__quote-muted">Enter symbol</p>
            ) : snapLoading ? (
              <p className="xoptions-mid-three__quote-muted">Loading…</p>
            ) : snapshot ? (
              <div className="xoptions-mid-three__quote-stack">
                <p className="xoptions-mid-three__quote-line">
                  <span className="xoptions-mid-three__quote-k">Last</span>{" "}
                  <span className="xoptions-mid-three__quote-val font-mono">
                    {snapshot.lastPrice != null ? snapshot.lastPrice.toFixed(2) : "—"}
                  </span>
                  {snapshot.currency ? (
                    <span className="xoptions-mid-three__quote-ccy"> {snapshot.currency}</span>
                  ) : null}
                </p>
                <p className="xoptions-mid-three__quote-line">
                  <span className="xoptions-mid-three__quote-k">RSI 14d</span>{" "}
                  <span className="xoptions-mid-three__quote-val font-mono">
                    {snapshot.rsi14 != null ? snapshot.rsi14.toFixed(1) : "—"}
                  </span>
                </p>
              </div>
            ) : (
              <p className="xoptions-mid-three__quote-muted">No quote</p>
            )}
          </div>

          <div
            className="xoptions-mid-three__col xoptions-moves min-w-0"
            aria-label="Last price plus and minus five, ten, and fifteen percent"
          >
            <p className="xoptions-mid-three__label">±5/10/15%</p>
            {symbol.trim().length === 0 ? (
              <p className="xoptions-mid-three__quote-muted">—</p>
            ) : snapLoading ? (
              <p className="xoptions-mid-three__quote-muted">…</p>
            ) : snapshot && snapshot.lastPrice != null ? (
              (() => {
                const lastPx = snapshot.lastPrice;
                return (
              <div className="xoptions-moves__grid">
                {MOVE_PCTS.map((pct) => (
                  <p key={`up-${pct}`} className="xoptions-moves__line">
                    <span className="xoptions-moves__tag xoptions-moves__tag--up">+{pct}%</span>
                    <span className="xoptions-moves__px font-mono">
                      {(lastPx * (1 + pct / 100)).toFixed(2)}
                    </span>
                  </p>
                ))}
                {MOVE_PCTS.map((pct) => (
                  <p key={`dn-${pct}`} className="xoptions-moves__line">
                    <span className="xoptions-moves__tag xoptions-moves__tag--dn">−{pct}%</span>
                    <span className="xoptions-moves__px font-mono">
                      {(lastPx * (1 - pct / 100)).toFixed(2)}
                    </span>
                  </p>
                ))}
              </div>
                );
              })()
            ) : (
              <p className="xoptions-mid-three__quote-muted">—</p>
            )}
          </div>
        </div>

        <details className="xoptions-desk-drop">
          <summary className="xoptions-desk-drop__summary">Outlook & risk (session)</summary>
          <div className="xoptions-desk-drop__body space-y-3">
            <div>
              <label className="xoptions-workspace__label block" htmlFor="xo-outlook">
                Outlook override
              </label>
              <select
                id="xo-outlook"
                className="crud-input mt-1 w-full max-w-xs"
                value={outlookOverride}
                onChange={(e) =>
                  setOutlookOverride(
                    e.target.value === "" ? "" : (e.target.value as AccountOutlook)
                  )
                }
              >
                <option value="">
                  Use account / book ({mergedOutlookLabels(ctx) || "—"})
                </option>
                <option value="bullish">{DESK_OUTLOOK_LABELS.bullish}</option>
                <option value="neutral">{DESK_OUTLOOK_LABELS.neutral}</option>
                <option value="bearish">{DESK_OUTLOOK_LABELS.bearish}</option>
              </select>
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
                <option value="growth">{DESK_RISK_DISPLAY_LABELS.growth}</option>
              </select>
            </div>
            <button type="button" className="xoptions-text-link text-sm" onClick={resetDeskToPortfolio}>
              Reset desk to portfolio
            </button>
          </div>
        </details>
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
