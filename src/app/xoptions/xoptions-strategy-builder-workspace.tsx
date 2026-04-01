"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ExternalLinkIcon } from "@/app/admin/ui/crud-icons";
import { OutlookIconFor, outlookIconClassForSlug } from "@/app/ui/outlook-icons";
import { XoptionsChooseContract } from "@/app/xoptions/xoptions-choose-contract";
import {
    StrategyChoicePanels,
    strategyShortLabel,
    type StrategyChoiceId
} from "@/app/xoptions/xoptions-strategy-choice-panels";
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
  accounts: Array<{
    id: string;
    name: string;
    extAccountId: string;
    isDefault: boolean;
    optionsApproved: boolean;
    riskProfile: "conservative" | "balanced" | "growth" | null;
    outlook: AccountOutlook | null;
  }>;
  account: {
    id: string | null;
    name: string;
    riskProfile: "conservative" | "balanced" | "growth" | null;
    outlook: AccountOutlook | null;
    optionsApproved: boolean;
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

type DeskAccountSlice = {
  id: string | null;
  name: string;
  riskProfile: "conservative" | "balanced" | "growth" | null;
  outlook: AccountOutlook | null;
  optionsApproved: boolean;
};

const WEEK_CHIPS: { label: string; days: number }[] = [
  { label: "1 wk", days: 7 },
  { label: "2 wk", days: 14 },
  { label: "4 wk", days: 28 }
];

const STEPS = [
  { n: 1 as const, title: "Input symbol", question: "Which company are you looking for?" },
  { n: 2 as const, title: "Choose outlook" },
  { n: 3 as const, title: "Choose strategy" },
  { n: 4 as const, title: "Choose contract" }
];

const OPTIONS_APPLY_URL = (process.env.NEXT_PUBLIC_XOPTIONS_OPTIONS_APPLY_URL ?? "").trim();

function riskLabel(r: DeskAccountSlice["riskProfile"] | null | undefined): string {
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

function mergedOutlookLabels(
  accountOutlook: AccountOutlook | null | undefined,
  bookOutlook: AccountOutlook | null | undefined
): string {
  const la = outlookLabel(accountOutlook);
  const lb = outlookLabel(bookOutlook);
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

function accountSelectLabel(row: ContextPayload["accounts"][number]): string {
  const tail = row.extAccountId && row.extAccountId !== "—" ? ` (${row.extAccountId})` : "";
  const name = row.name.length > 22 ? `${row.name.slice(0, 20)}…` : row.name;
  return `${name}${tail}`;
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
  const [weeks, setWeeks] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<(typeof STEPS)[number]["n"]>(1);
  /** Highest step the user may open (1–4); advances on Next, never ahead of symbol readiness. */
  const [unlockedStep, setUnlockedStep] = useState(1);
  const [strategyChoiceId, setStrategyChoiceId] = useState<StrategyChoiceId | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

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
    const json = (await res.json()) as { data: Partial<ContextPayload> };
    const d = json.data;
    if (!d || typeof d !== "object") {
      setCtxErr("Could not load portfolio context.");
      return;
    }
    setCtx({
      portfolio: d.portfolio ?? null,
      accounts: Array.isArray(d.accounts) ? d.accounts : [],
      account: {
        id: d.account?.id ?? null,
        name: d.account?.name ?? "Account",
        riskProfile: d.account?.riskProfile ?? null,
        outlook: d.account?.outlook ?? null,
        optionsApproved: Boolean(d.account?.optionsApproved)
      },
      bookOutlook: d.bookOutlook ?? null,
      bookRiskProfile: d.bookRiskProfile ?? null,
      scoringFactors: Array.isArray(d.scoringFactors) ? d.scoringFactors : []
    });
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
    setSelectedAccountId((prev) => {
      if (prev !== null) return prev;
      return ctx.account.id ?? ctx.accounts[0]?.id ?? null;
    });
  }, [ctx]);

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

  const selectedDeskAccount = useMemo((): DeskAccountSlice | null => {
    if (!ctx) return null;
    const id = selectedAccountId ?? ctx.account.id;
    const row = ctx.accounts.find((a) => a.id === id);
    if (row) {
      return {
        id: row.id,
        name: row.name,
        riskProfile: row.riskProfile,
        outlook: row.outlook,
        optionsApproved: row.optionsApproved
      };
    }
    return {
      id: ctx.account.id,
      name: ctx.account.name,
      riskProfile: ctx.account.riskProfile,
      outlook: ctx.account.outlook,
      optionsApproved: ctx.account.optionsApproved
    };
  }, [ctx, selectedAccountId]);

  const effectiveOutlook = useMemo(() => {
    if (outlookOverride !== "") {
      return outlookLabel(outlookOverride);
    }
    return mergedOutlookLabels(selectedDeskAccount?.outlook, ctx?.bookOutlook);
  }, [ctx?.bookOutlook, outlookOverride, selectedDeskAccount?.outlook]);

  const outlookIconSlug = useMemo((): AccountOutlook | null => {
    if (outlookOverride !== "") {
      return outlookOverride;
    }
    if (!ctx) {
      return null;
    }
    return selectedDeskAccount?.outlook ?? ctx.bookOutlook ?? null;
  }, [ctx, outlookOverride, selectedDeskAccount?.outlook]);

  const effectiveRisk = useMemo(() => {
    const r = riskOverride || selectedDeskAccount?.riskProfile || ctx?.bookRiskProfile || null;
    return riskLabel(r);
  }, [ctx?.bookRiskProfile, riskOverride, selectedDeskAccount?.riskProfile]);

  const effectiveFactors = useMemo(() => factorWeights ?? [], [factorWeights]);

  const weightSum = useMemo(
    () => effectiveFactors.reduce((s, f) => s + f.weight, 0),
    [effectiveFactors]
  );
  const weightOk = Math.abs(weightSum - 1) < 0.02;

  const symbolUpper = symbol.trim().toUpperCase();
  const step1Complete = symbolUpper.length >= 1 && !snapLoading;
  const canGoStep2 = step1Complete;

  useEffect(() => {
    if (!canGoStep2) {
      setUnlockedStep(1);
      setActiveStep((s) => (s > 1 ? 1 : s));
      setStrategyChoiceId(null);
    }
  }, [canGoStep2]);

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

  function goStep(n: (typeof STEPS)[number]["n"]) {
    if (n < 1 || n > 4 || n > unlockedStep) return;
    setActiveStep(n);
  }

  function advanceFrom(step: (typeof STEPS)[number]["n"]) {
    if (step < 1 || step > 3) return;
    if (step === 1 && !canGoStep2) return;
    const next = (step + 1) as (typeof STEPS)[number]["n"];
    setUnlockedStep((u) => Math.max(u, next));
    setActiveStep(next);
  }

  function stepHeaderClass(n: (typeof STEPS)[number]["n"]): string {
    if (n === activeStep) return "xoptions-step__head xoptions-step__head--active";
    if (n < activeStep) return "xoptions-step__head xoptions-step__head--done";
    return "xoptions-step__head xoptions-step__head--pending";
  }

  return (
    <div className="xoptions-workspace space-y-4 max-w-6xl">
      <div>
        <p className="xoptions-page-kicker">Options analysis &amp; research</p>
        <h1 className="xoptions-workspace__h1 mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Option Strategy Builder
        </h1>
      </div>

      <nav className="xoptions-stepper" aria-label="Strategy builder progress">
        {STEPS.map((s, i) => (
          <div key={s.n} className="xoptions-stepper__segment">
            <button
              type="button"
              className={`xoptions-stepper__node ${s.n === activeStep ? "xoptions-stepper__node--current" : ""} ${s.n < activeStep ? "xoptions-stepper__node--complete" : ""} ${s.n > activeStep ? "xoptions-stepper__node--future" : ""}`}
              aria-current={s.n === activeStep ? "step" : undefined}
              disabled={s.n > unlockedStep}
              onClick={() => goStep(s.n)}
            >
              <span className="xoptions-stepper__node-num">{s.n}</span>
              <span className="xoptions-stepper__node-label">{s.title}</span>
            </button>
            {i < STEPS.length - 1 ? <span className="xoptions-stepper__rail" aria-hidden /> : null}
          </div>
        ))}
      </nav>

      <section className="xoptions-account-bar" aria-label="Account">
        <div className="xoptions-account-bar__row">
          <label className="xoptions-top-option-header__label block" htmlFor="xo-account">
            Account
          </label>
          {ctx && ctx.accounts.length > 0 ? (
            <select
              id="xo-account"
              className="crud-input mt-0.5 w-full max-w-md font-mono text-sm"
              value={selectedAccountId ?? ""}
              onChange={(e) => setSelectedAccountId(e.target.value || null)}
            >
              {ctx.accounts.map((row) => (
                <option key={row.id} value={row.id}>
                  {accountSelectLabel(row)}
                </option>
              ))}
            </select>
          ) : (
            <p className="xoptions-top-option-header__stat mt-0.5">{ctx?.account.name ?? "—"}</p>
          )}
        </div>
        {selectedDeskAccount && !selectedDeskAccount.optionsApproved ? (
          <div className="xoptions-account-bar__notice" role="status">
            <span className="xoptions-account-bar__notice-icon" aria-hidden>
              ⓘ
            </span>
            <span className="xoptions-account-bar__notice-text">
              This account does not have options trading enabled in xFinance. Research and chain tools still work; to
              trade, enable options with your custodian.
            </span>
            {OPTIONS_APPLY_URL ? (
              <a
                href={OPTIONS_APPLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="xoptions-account-bar__apply inline-flex items-center gap-1"
              >
                Apply here
                <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              </a>
            ) : null}
          </div>
        ) : null}
        <p className="xoptions-top-option-header__hint mt-1">{ctx?.portfolio?.name ?? "Default portfolio"}</p>
      </section>

      <section className="xoptions-top-option-header xoptions-top-option-header--glance-only" aria-label="At a glance">
        <aside className="xoptions-top-option-header__col xoptions-top-option-header__col--glance min-w-0 w-full" aria-label="At a glance">
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
                          onClick={() => {
                            setSymbol(row.symbol);
                            setActiveStep(1);
                          }}
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
                          onClick={() => {
                            setSymbol(row.symbol);
                            setActiveStep(1);
                          }}
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

      <div className="xoptions-steps space-y-0" aria-label="Builder steps">
        {/* Step 1 */}
        <section className="xoptions-step" aria-labelledby="xo-step-1-title">
          <button
            type="button"
            className={stepHeaderClass(1)}
            id="xo-step-1-title"
            onClick={() => goStep(1)}
          >
            <span className="xoptions-step__num">1</span>
            <span className="xoptions-step__title">{STEPS[0]?.title}</span>
            {activeStep !== 1 && symbolUpper ? (
              <span className="xoptions-step__summary font-mono">{symbolUpper}</span>
            ) : null}
          </button>
          {activeStep === 1 ? (
            <div className="xoptions-step__body">
              <p className="xoptions-step__question">{STEPS[0]?.question}</p>
              <div className="relative mt-2 max-w-md">
                <label className="sr-only" htmlFor="xo-symbol">
                  Symbol
                </label>
                <input
                  id="xo-symbol"
                  className="crud-input w-full pr-10 font-mono text-sm uppercase"
                  placeholder="Symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  aria-label="Underlying symbol"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--xf-text-400)]" aria-hidden>
                  🔍
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="xoptions-next-btn"
                  disabled={!canGoStep2}
                  onClick={() => advanceFrom(1)}
                >
                  Next
                </button>
                {symbolUpper.length > 0 ? (
                  <div className="text-xs text-[var(--xf-text-400)]" role="status">
                    {snapLoading ? "Loading quote…" : snapshot?.symbol === symbolUpper ? `Last ${snapshot.lastPrice ?? "—"}` : "Enter a valid symbol"}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {/* Step 2 */}
        <section className="xoptions-step" aria-labelledby="xo-step-2-title">
          <button
            type="button"
            className={stepHeaderClass(2)}
            id="xo-step-2-title"
            disabled={unlockedStep < 2}
            onClick={() => goStep(2)}
          >
            <span className="xoptions-step__num">2</span>
            <span className="xoptions-step__title">{STEPS[1]?.title}</span>
            {activeStep !== 2 && unlockedStep >= 2 ? (
              <span className="xoptions-step__summary">
                {effectiveOutlook || "—"} · {effectiveRisk}
              </span>
            ) : null}
          </button>
          {activeStep === 2 && canGoStep2 ? (
            <div className="xoptions-step__body space-y-4">
              <div className="xoptions-top-option-header__desk xoptions-step__desk-card p-2">
                <p className="xoptions-top-option-header__desk-line line-clamp-2 inline-flex flex-wrap items-center gap-1.5">
                  <span className="xoptions-inline-muted shrink-0">Outlook </span>
                  {outlookIconSlug ? (
                    <span
                      className={`inline-flex shrink-0 items-center ${outlookIconClassForSlug(outlookIconSlug)}`}
                      aria-hidden
                    >
                      <OutlookIconFor className="h-4 w-4" outlook={outlookIconSlug} />
                    </span>
                  ) : null}
                  <span>{effectiveOutlook || "—"}</span>
                </p>
                <p className="xoptions-top-option-header__desk-line">
                  <span className="xoptions-inline-muted">Risk </span>
                  {ctx ? effectiveRisk : "—"}
                </p>
              </div>
              <div>
                <label className="xoptions-workspace__label block" htmlFor="xo-outlook">
                  Outlook override
                </label>
                <div className="mt-1 flex max-w-xs items-center gap-2">
                  {outlookIconSlug ? (
                    <span
                      className={`inline-flex shrink-0 ${outlookIconClassForSlug(outlookIconSlug)}`}
                      aria-hidden
                    >
                      <OutlookIconFor className="h-5 w-5" outlook={outlookIconSlug} />
                    </span>
                  ) : (
                    <span className="inline-flex h-5 w-5 shrink-0" aria-hidden />
                  )}
                  <select
                    id="xo-outlook"
                    className="crud-input min-w-0 flex-1"
                    value={outlookOverride}
                    onChange={(e) =>
                      setOutlookOverride(
                        e.target.value === "" ? "" : (e.target.value as AccountOutlook)
                      )
                    }
                  >
                    <option value="">
                      Use account / book (
                      {mergedOutlookLabels(selectedDeskAccount?.outlook, ctx?.bookOutlook) || "—"})
                    </option>
                    <option value="bullish">{DESK_OUTLOOK_LABELS.bullish}</option>
                    <option value="neutral">{DESK_OUTLOOK_LABELS.neutral}</option>
                    <option value="bearish">{DESK_OUTLOOK_LABELS.bearish}</option>
                  </select>
                </div>
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
                  <option value="">
                    Use portfolio / account (
                    {riskLabel(selectedDeskAccount?.riskProfile ?? ctx?.bookRiskProfile ?? null)})
                  </option>
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="growth">{DESK_RISK_DISPLAY_LABELS.growth}</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="xoptions-text-link text-sm" onClick={resetDeskToPortfolio}>
                  Reset desk to portfolio
                </button>
                <button type="button" className="xoptions-next-btn" onClick={() => advanceFrom(2)}>
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Step 3 */}
        <section className="xoptions-step" aria-labelledby="xo-step-3-title">
          <button
            type="button"
            className={stepHeaderClass(3)}
            id="xo-step-3-title"
            disabled={unlockedStep < 3}
            onClick={() => goStep(3)}
          >
            <span className="xoptions-step__num">3</span>
            <span className="xoptions-step__title">{STEPS[2]?.title}</span>
            {activeStep !== 3 && unlockedStep >= 3 ? (
              <span className="xoptions-step__summary">
                {[
                  weeks != null ? `~${weeks}d` : null,
                  strategyShortLabel(strategyChoiceId)
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            ) : null}
          </button>
          {activeStep === 3 && canGoStep2 ? (
            <div className="xoptions-step__body space-y-4">
              <StrategyChoicePanels
                symbol={symbol}
                selectedId={strategyChoiceId}
                onSelectStrategy={setStrategyChoiceId}
              />
              <div>
                <p className="xoptions-top-option-header__label">Target expiration</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {WEEK_CHIPS.map((w) => (
                    <button
                      key={w.days}
                      type="button"
                      className={`xoptions-choice ${weeks !== null && weeks === w.days ? "xoptions-choice--active" : ""}`}
                      onClick={() => setWeeks(w.days)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <p className="xoptions-hint mt-1 text-xs">
                  {weeks === null ? "Select a horizon for the chain" : `~${weeks}d in chain`}
                </p>
              </div>
              <div className="min-w-0 text-left">
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
              <button type="button" className="xoptions-next-btn" onClick={() => advanceFrom(3)}>
                Next
              </button>
            </div>
          ) : null}
        </section>

        {/* Step 4 */}
        <section className="xoptions-step" aria-labelledby="xo-step-4-title">
          <button
            type="button"
            className={stepHeaderClass(4)}
            id="xo-step-4-title"
            disabled={unlockedStep < 4}
            onClick={() => goStep(4)}
          >
            <span className="xoptions-step__num">4</span>
            <span className="xoptions-step__title">{STEPS[3]?.title}</span>
          </button>
          {activeStep === 4 && canGoStep2 ? (
            <div className="xoptions-step__body space-y-4">
              <XoptionsChooseContract
                symbol={symbol}
                weeks={weeks}
                lastPrice={snapshot?.lastPrice ?? null}
              />
              <div>
                <Link
                  className="cta cta-primary xoptions-chain-cta"
                  href={
                    symbol.trim()
                      ? `/xstrategybuilder/strategy-options?symbol=${encodeURIComponent(symbol.trim())}`
                      : "/xstrategybuilder/strategy-options"
                  }
                >
                  Open full option chain
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
