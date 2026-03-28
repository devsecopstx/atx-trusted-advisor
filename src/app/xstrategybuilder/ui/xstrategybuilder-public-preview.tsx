"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";
import { OptionsPayoffChart } from "@/app/xstrategybuilder/ui/options-payoff-chart";
import type { OptionsPayoffLeg } from "@/lib/options-payoff";
import {
    INVESTMENT_STRATEGY_OPTIONS,
    RISK_LEVEL_OPTIONS
} from "@/modules/core-admin/portfolio-preference-labels";

import type { XsbInitialWorkspace, XsbWorkspaceAccount, XsbWorkspacePortfolio } from "../workspace-types";

type SymbolOption = {
  symbol: string;
  note: string;
};

type StrategyOption = {
  id: string;
  label: string;
  summary: string;
};

const WATCHLIST_SYMBOLS: SymbolOption[] = [
  { symbol: "TSLA", note: "High-liquidity growth" },
  { symbol: "NVDA", note: "Momentum + options volume" },
  { symbol: "AAPL", note: "Large-cap liquidity" },
  { symbol: "MSFT", note: "Mega-cap stability" },
  { symbol: "RDW", note: "Small-cap volatility" },
  { symbol: "LUNR", note: "Event-driven IV" }
];

const STRATEGY_OPTIONS: StrategyOption[] = [
  { id: "covered-calls", label: "Covered Calls", summary: "Income overlay on long stock positions." },
  { id: "cash-secured-puts", label: "Cash-Secured Puts", summary: "Collect premium while targeting a discounted entry." },
  { id: "bull-put-credit-spread", label: "Bull Put Credit Spread", summary: "Defined-risk bullish premium structure." },
  { id: "bull-call-debit-spread", label: "Bull Call Debit Spread", summary: "Defined-cost directional upside spread." },
  { id: "calendar-spread", label: "Calendar Spread", summary: "Time-structure play using same-strike expirations." },
  { id: "diagonal-spread", label: "Diagonal Spread", summary: "Staggered strike + expiration theta overlay." },
  { id: "poor-mans-covered-call", label: "Poor Man's Covered Call", summary: "LEAP call proxy with short call income." },
  { id: "leap-call-cc-overlay", label: "LEAP Call + CC Overlay", summary: "Long-dated call with recurring short calls." },
  { id: "iron-condor", label: "Iron Condor", summary: "Defined-risk neutral premium capture." },
  { id: "wheel", label: "Wheel", summary: "CSP to covered-call cycle with assignment discipline." }
];

const SYMBOL_SPOT_HINTS: Record<string, number> = {
  TSLA: 250,
  NVDA: 120,
  AAPL: 200,
  MSFT: 420,
  RDW: 9,
  LUNR: 8
};

type SpotMode = "live" | "manual";

function createLeg(partial?: Partial<OptionsPayoffLeg>): OptionsPayoffLeg {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `leg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: partial?.type ?? "call",
    strike: partial?.strike ?? 100,
    premium: partial?.premium ?? 2,
    quantity: partial?.quantity ?? 1,
    side: partial?.side ?? "long"
  };
}

function buildTemplateLegs(strategyId: string | null, currentPrice: number): OptionsPayoffLeg[] {
  const spot = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 100;
  switch (strategyId) {
    case "covered-calls":
      return [createLeg({ type: "call", side: "short", strike: spot * 1.05, premium: 3.2 })];
    case "cash-secured-puts":
      return [createLeg({ type: "put", side: "short", strike: spot * 0.95, premium: 3 })];
    case "bull-put-credit-spread":
      return [
        createLeg({ type: "put", side: "short", strike: spot * 0.97, premium: 4 }),
        createLeg({ type: "put", side: "long", strike: spot * 0.92, premium: 2.2 })
      ];
    case "bull-call-debit-spread":
      return [
        createLeg({ type: "call", side: "long", strike: spot, premium: 4.5 }),
        createLeg({ type: "call", side: "short", strike: spot * 1.06, premium: 1.9 })
      ];
    case "calendar-spread":
    case "diagonal-spread":
      return [
        createLeg({ type: "call", side: "long", strike: spot * 0.98, premium: 6.5 }),
        createLeg({ type: "call", side: "short", strike: spot * 1.03, premium: 2.5 })
      ];
    case "poor-mans-covered-call":
    case "leap-call-cc-overlay":
      return [
        createLeg({ type: "call", side: "long", strike: spot * 0.85, premium: 14 }),
        createLeg({ type: "call", side: "short", strike: spot * 1.06, premium: 2.8 })
      ];
    case "iron-condor":
      return [
        createLeg({ type: "put", side: "long", strike: spot * 0.88, premium: 1.1 }),
        createLeg({ type: "put", side: "short", strike: spot * 0.93, premium: 2.4 }),
        createLeg({ type: "call", side: "short", strike: spot * 1.07, premium: 2.3 }),
        createLeg({ type: "call", side: "long", strike: spot * 1.12, premium: 1.1 })
      ];
    case "wheel":
      return [createLeg({ type: "put", side: "short", strike: spot * 0.95, premium: 3 })];
    default:
      return [
        createLeg({ type: "call", side: "long", strike: spot, premium: 3.8 }),
        createLeg({ type: "call", side: "short", strike: spot * 1.06, premium: 1.8 })
      ];
  }
}

function normalizeMoneyInput(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Number(parsed.toFixed(2));
}

function riskLabel(account: XsbWorkspaceAccount): string {
  if (account.riskProfile == null) {
    return "Not set";
  }
  return RISK_LEVEL_OPTIONS.find((r) => r.riskProfile === account.riskProfile)?.label ?? account.riskProfile;
}

function outlookLabel(account: XsbWorkspaceAccount): string {
  if (account.outlook == null) {
    return "Not set";
  }
  return INVESTMENT_STRATEGY_OPTIONS.find((o) => o.value === account.outlook)?.title ?? account.outlook;
}

export type XstrategybuilderPublicPreviewProps = {
  initialWorkspace: XsbInitialWorkspace;
};

type XsbStep = 1 | 2 | 3 | 4 | 5;

export function XstrategybuilderPublicPreview({ initialWorkspace }: XstrategybuilderPublicPreviewProps) {
  const router = useRouter();

  const portfolio: XsbWorkspacePortfolio | null =
    initialWorkspace.status === "ready" ? initialWorkspace.portfolio : null;

  const accounts = useMemo(() => portfolio?.accounts ?? [], [portfolio]);
  const [activeStep, setActiveStep] = useState<XsbStep>(1);
  const [expandedSteps, setExpandedSteps] = useState<Record<XsbStep, boolean>>({
    1: true,
    2: true,
    3: false,
    4: false,
    5: false
  });

  const symbolUniverse = useMemo(() => WATCHLIST_SYMBOLS, []);
  const [symbolQuery, setSymbolQuery] = useState<string>(symbolUniverse[0]?.symbol ?? "TSLA");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbolUniverse[0]?.symbol ?? "TSLA");
  const filteredSymbols = useMemo(() => {
    const query = symbolQuery.trim().toUpperCase();
    if (!query) {
      return symbolUniverse;
    }
    return symbolUniverse.filter((item) => item.symbol.includes(query) || item.note.toUpperCase().includes(query));
  }, [symbolQuery, symbolUniverse]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const selectedStrategy = useMemo(
    () => STRATEGY_OPTIONS.find((option) => option.id === selectedStrategyId) ?? null,
    [selectedStrategyId]
  );
  const canContinueFromStep1 = true;
  const canContinueFromStep2 = Boolean(selectedSymbol);
  const canContinueFromStep3 = canContinueFromStep2 && Boolean(selectedStrategyId);
  const [currentPrice, setCurrentPrice] = useState<number>(SYMBOL_SPOT_HINTS.TSLA);
  const [spotMode, setSpotMode] = useState<SpotMode>("live");
  const [payoffLegs, setPayoffLegs] = useState<OptionsPayoffLeg[]>(() =>
    buildTemplateLegs(null, SYMBOL_SPOT_HINTS.TSLA)
  );
  const { quotes: liveQuotes, loading: quoteLoading } = useSymbolQuotes([selectedSymbol], { refreshMs: 30_000 });
  const livePrice = liveQuotes[selectedSymbol]?.price;

  useEffect(() => {
    if (spotMode !== "live") {
      return;
    }
    if (typeof livePrice !== "number" || !Number.isFinite(livePrice) || livePrice <= 0) {
      return;
    }
    setCurrentPrice(Number(livePrice.toFixed(2)));
  }, [livePrice, spotMode]);
  const hasMissingUserContextSettings = useMemo(
    () =>
      initialWorkspace.status === "error" ||
      !portfolio ||
      portfolio.accounts.length === 0 ||
      portfolio.accounts.some((account) => account.riskProfile == null || account.outlook == null),
    [initialWorkspace.status, portfolio]
  );

  const priceTargets = useMemo(
    () => [
      { label: "-15%", value: currentPrice * 0.85 },
      { label: "-10%", value: currentPrice * 0.9 },
      { label: "-5%", value: currentPrice * 0.95 },
      { label: "+5%", value: currentPrice * 1.05 },
      { label: "+10%", value: currentPrice * 1.1 },
      { label: "+15%", value: currentPrice * 1.15 }
    ],
    [currentPrice]
  );

  const toggleStep = (step: XsbStep) => {
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const goToStep = (step: XsbStep) => {
    setActiveStep(step);
    setExpandedSteps({
      1: step === 1,
      2: step === 2,
      3: step === 3,
      4: step === 4,
      5: step === 5
    });
  };

  const money = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }),
    []
  );

  return (
    <div
      aria-label="xStrategyBuilder — OptionsStrategyEngine guided steps (preview)"
      className="xsb-builder-preview xsb-builder-preview--friendly"
      role="region"
    >
      <section className="xsb-price-band" aria-label="Current price and target strike bands">
        <div className="xsb-price-band__left">
          <span className="xsb-price-band__k">Symbol</span>
          <span className="xsb-price-band__v">{selectedSymbol}</span>
          <span className="xsb-price-band__k">Current</span>
          <span className="xsb-price-band__v">{money.format(currentPrice)}</span>
          <span className="xsb-price-band__k">
            {spotMode === "live" ? (quoteLoading ? "Live refresh..." : "Live (Yahoo)") : "Manual override"}
          </span>
        </div>
        <div className="xsb-price-band__targets" role="list">
          {priceTargets.map((target) => (
            <span key={target.label} className="xsb-price-band__target" role="listitem">
              {target.label} <strong>{money.format(target.value)}</strong>
            </span>
          ))}
        </div>
      </section>

      <ol className="xsb-engine-steps">
        <li className={`xsb-engine-step xsb-engine-step--panel${activeStep === 1 ? " xsb-engine-step--active" : ""}`}>
          <button
            type="button"
            className="xsb-engine-step__head-btn"
            onClick={() => toggleStep(1)}
            aria-expanded={expandedSteps[1]}
          >
            <div className="xsb-engine-step__head">
              <span className="xsb-engine-step__n" aria-hidden>
                1
              </span>
              <div>
                <h3 className="xsb-engine-step__title">User context</h3>
                <p className="xsb-engine-step__sub">
                  OptionsStrategyEngine <code className="xsb-inline-code">buildUserContext</code> — portfolio book,
                  account <strong>risk</strong> and <strong>outlook</strong> (terminology from the engine spec).
                </p>
              </div>
            </div>
            <span className={`xsb-engine-step__chevron${expandedSteps[1] ? "" : " xsb-engine-step__chevron--collapsed"}`} aria-hidden>
              ▼
            </span>
          </button>
          {expandedSteps[1] ? (
            <div className="xsb-engine-step__body">
              {hasMissingUserContextSettings ? (
                <>
                  {initialWorkspace.status === "error" ? (
                    <div className="xsb-friendly-error xsb-friendly-error--block">
                      <p>{initialWorkspace.message}</p>
                      <button className="xsb-friendly-retry" onClick={() => router.refresh()} type="button">
                        <RefreshIcon className="crud-icon" />
                        Reload page
                      </button>
                    </div>
                  ) : portfolio ? (
                    <>
                      <p className="xsb-friendly-hint xsb-friendly-hint--tight">
                        Missing account context detected for this default workspace book. Complete risk/outlook to
                        unlock deterministic strategy scoring.
                      </p>
                      {accounts.length === 0 ? (
                        <p className="xsb-friendly-hint">
                          No custodian accounts linked yet. Add accounts from{" "}
                          <a className="xsb-friendly-link" href="/portfolio">
                            Portfolio
                          </a>
                          .
                        </p>
                      ) : (
                        <ul className="xsb-context-account-list" role="list">
                          {accounts.map((acc) => (
                            <li key={acc._id ?? `${acc.name}-${acc.accountRef}`} className="xsb-context-account-row">
                              <span className="xsb-context-account-name">{acc.name}</span>
                              <span className="xsb-context-account-meta">
                                {acc.brokerType}
                                {acc.accountRef ? ` · ${acc.accountRef}` : ""}
                              </span>
                              <span className="xsb-context-account-desk">
                                Risk: <strong>{riskLabel(acc)}</strong>
                                {" · "}
                                Outlook: <strong>{outlookLabel(acc)}</strong>
                              </span>
                              <span className="xsb-context-account-balance">{money.format(acc.balance)} cash</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : null}
                </>
              ) : (
                <p className="xsb-friendly-hint xsb-friendly-hint--tight">
                  Default workspace context is complete. User context stays hidden by design.
                </p>
              )}
              <div className="xsb-step-actions">
                <button type="button" className="xsb-engine-cta" onClick={() => goToStep(2)}>
                  Continue to Step 2
                </button>
              </div>
            </div>
          ) : null}
        </li>

        <li className={`xsb-engine-step xsb-engine-step--panel${activeStep === 2 ? " xsb-engine-step--active" : ""}`}>
          <button
            type="button"
            className="xsb-engine-step__head-btn"
            onClick={() => toggleStep(2)}
            aria-expanded={expandedSteps[2]}
          >
            <div className="xsb-engine-step__head">
              <span className="xsb-engine-step__n" aria-hidden>
                2
              </span>
              <div>
                <h3 className="xsb-engine-step__title">Select a symbol</h3>
                <p className="xsb-engine-step__sub">
                  Pull option chains per ticker; pick expirations and strikes in the live console (Yahoo-aligned chain
                  rows).
                </p>
              </div>
            </div>
            <span className={`xsb-engine-step__chevron${expandedSteps[2] ? "" : " xsb-engine-step__chevron--collapsed"}`} aria-hidden>
              ▼
            </span>
          </button>
          {expandedSteps[2] ? <div className="xsb-engine-step__body">
            <div className="xsb-builder-panel xsb-builder-panel--friendly">
              <label className="xsb-live-symbol-picker" htmlFor="xsb-live-symbol-query">
                Symbol picker
                <input
                  id="xsb-live-symbol-query"
                  className="xsb-builder-nl-input"
                  placeholder="Search ticker (e.g. TSLA)"
                  value={symbolQuery}
                  onChange={(event) => {
                    const value = event.target.value.toUpperCase();
                    setSymbolQuery(value);
                    if (value && symbolUniverse.some((item) => item.symbol === value)) {
                      setSelectedSymbol(value);
                      setSpotMode("live");
                      setCurrentPrice(SYMBOL_SPOT_HINTS[value] ?? currentPrice);
                      setExpandedSteps((prev) => ({ ...prev, 1: false, 2: true }));
                    }
                  }}
                />
              </label>
              <div className="xsb-live-symbol-list" role="list">
                {filteredSymbols.slice(0, 6).map((item) => {
                  const isActive = item.symbol === selectedSymbol;
                  return (
                    <button
                      key={item.symbol}
                      className={`xsb-live-symbol-item${isActive ? " xsb-live-symbol-item--active" : ""}`}
                      type="button"
                      role="listitem"
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setSpotMode("live");
                        setSymbolQuery(item.symbol);
                        setCurrentPrice(SYMBOL_SPOT_HINTS[item.symbol] ?? currentPrice);
                        setExpandedSteps((prev) => ({ ...prev, 1: false, 2: true }));
                      }}
                    >
                      <span className="xsb-live-symbol-item__symbol">{item.symbol}</span>
                      <span className="xsb-live-symbol-item__note">{item.note}</span>
                    </button>
                  );
                })}
              </div>
              <p className="xsb-friendly-hint xsb-friendly-hint--tight">
                Selected symbol <strong>{selectedSymbol}</strong> will feed chains/expiration selection in the live
                options console.
              </p>
            </div>
            <p className="xsb-builder-watchlist-label">Top from watchlist (CSP / CC volatility)</p>
            <div className="xsb-builder-chips" role="list">
              {symbolUniverse.map((item) => (
                <span key={item.symbol} className="xsb-builder-chip" role="listitem">
                  {item.symbol}
                </span>
              ))}
            </div>
            <div className="xsb-step-actions">
              <button
                type="button"
                className="xsb-engine-cta"
                disabled={!canContinueFromStep2}
                onClick={() => goToStep(3)}
              >
                Continue to Step 3
              </button>
            </div>
          </div> : null}
        </li>

        <li className={`xsb-engine-step xsb-engine-step--panel${activeStep === 3 ? " xsb-engine-step--active" : ""}`}>
          <button
            type="button"
            className="xsb-engine-step__head-btn"
            onClick={() => toggleStep(3)}
            aria-expanded={expandedSteps[3]}
          >
            <div className="xsb-engine-step__head">
              <span className="xsb-engine-step__n" aria-hidden>
                3
              </span>
              <div>
                <h3 className="xsb-engine-step__title">Choose strategy</h3>
                <p className="xsb-engine-step__sub">
                  <code className="xsb-inline-code">filterEligibleStrategies</code> — book risk tolerance and market
                  outlook drop strategies that violate margin or stance before scoring runs.
                </p>
              </div>
            </div>
            <span className={`xsb-engine-step__chevron${expandedSteps[3] ? "" : " xsb-engine-step__chevron--collapsed"}`} aria-hidden>
              ▼
            </span>
          </button>
          {expandedSteps[3] ? (
            <div className="xsb-engine-step__body">
              <div className="xsb-live-strategy-list" role="list">
                {STRATEGY_OPTIONS.map((option) => {
                  const isActive = selectedStrategyId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="listitem"
                      className={`xsb-live-strategy-item${isActive ? " xsb-live-strategy-item--active" : ""}`}
                      onClick={() => {
                        setSelectedStrategyId(option.id);
                        setPayoffLegs(buildTemplateLegs(option.id, currentPrice));
                        setExpandedSteps((prev) => ({ ...prev, 1: false, 2: false, 3: true }));
                      }}
                    >
                      <span className="xsb-live-strategy-item__label">{option.label}</span>
                      <span className="xsb-live-strategy-item__summary">{option.summary}</span>
                    </button>
                  );
                })}
              </div>
              <p className="xsb-friendly-hint xsb-friendly-hint--tight">
                {selectedStrategy
                  ? (
                    <>
                      Selected strategy <strong>{selectedStrategy.label}</strong> for fit-scoring and leg generation.
                    </>
                    )
                  : "Select one strategy to continue to portfolio fit scoring."}
              </p>
              <div className="xsb-step-actions">
                <button type="button" className="xsb-engine-cta" disabled={!canContinueFromStep3} onClick={() => goToStep(4)}>
                  Continue to Step 4
                </button>
              </div>
            </div>
          ) : null}
        </li>

        <li className={`xsb-engine-step xsb-engine-step--panel${activeStep === 4 ? " xsb-engine-step--active" : ""}`}>
          <button
            type="button"
            className="xsb-engine-step__head-btn"
            onClick={() => toggleStep(4)}
            aria-expanded={expandedSteps[4]}
          >
            <div className="xsb-engine-step__head">
              <span className="xsb-engine-step__n" aria-hidden>
                4
              </span>
              <div>
                <h3 className="xsb-engine-step__title">Fit score (portfolio factors)</h3>
                <p className="xsb-engine-step__sub">
                  <code className="xsb-inline-code">calculateFitScore</code> — weighted 0–100 from book-level{" "}
                  <strong>portfolio scoring factors</strong> (distinct from account outlook/risk). Admins tune weights;
                  defaults match the engine spec.
                </p>
              </div>
            </div>
            <span className={`xsb-engine-step__chevron${expandedSteps[4] ? "" : " xsb-engine-step__chevron--collapsed"}`} aria-hidden>
              ▼
            </span>
          </button>
          {expandedSteps[4] ? (
            <div className="xsb-engine-step__body">
              <p className="xsb-friendly-hint xsb-friendly-hint--tight">
                Scoring model runs in the background with safe fallback behavior and can be overridden by the user in
                prompt context. No score internals are exposed in UI.
              </p>
              <div className="xsb-step-actions">
                <button type="button" className="xsb-engine-cta" disabled={!canContinueFromStep3} onClick={() => goToStep(5)}>
                  Continue to Step 5
                </button>
              </div>
            </div>
          ) : null}
        </li>

        <li className={`xsb-engine-step xsb-engine-step--panel${activeStep === 5 ? " xsb-engine-step--active" : ""}`}>
          <button
            type="button"
            className="xsb-engine-step__head-btn"
            onClick={() => toggleStep(5)}
            aria-expanded={expandedSteps[5]}
          >
            <div className="xsb-engine-step__head">
              <span className="xsb-engine-step__n" aria-hidden>
                5
              </span>
              <div>
                <h3 className="xsb-engine-step__title">Legs, risk / reward, rationale</h3>
                <p className="xsb-engine-step__sub">
                  <code className="xsb-inline-code">buildOptionLegs</code> →{" "}
                  <code className="xsb-inline-code">calculateRiskRewardMetrics</code> →{" "}
                  <code className="xsb-inline-code">generateRationale</code> → rank. Structured recommendation object
                  aligns with xfinance-strategy builder service contracts.
                </p>
              </div>
            </div>
            <span className={`xsb-engine-step__chevron${expandedSteps[5] ? "" : " xsb-engine-step__chevron--collapsed"}`} aria-hidden>
              ▼
            </span>
          </button>
          {expandedSteps[5] ? <div className="xsb-engine-step__body">
            <p className="xsb-friendly-hint xsb-friendly-hint--tight">
              Open the live chain console to work strikes, expirations, and execution context.
            </p>
            {selectedStrategy ? (
              <p className="xsb-friendly-hint xsb-friendly-hint--tight">
                Active strategy: <strong>{selectedStrategy.label}</strong>.
              </p>
            ) : null}
            <div className="xsb-payoff-lab">
              <div className="xsb-payoff-lab__head">
                <p className="xsb-friendly-section-label">Live payoff simulation (expiration)</p>
                <label className="xsb-payoff-lab__spot" htmlFor="xsb-payoff-spot">
                  Spot
                  <input
                    id="xsb-payoff-spot"
                    className="xsb-builder-nl-input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    value={currentPrice}
                    onChange={(event) => {
                      setSpotMode("manual");
                      setCurrentPrice(normalizeMoneyInput(event.target.value, currentPrice));
                    }}
                  />
                </label>
                <button
                  className="xsb-engine-cta xsb-engine-cta--ghost"
                  disabled={typeof livePrice !== "number" || !Number.isFinite(livePrice) || livePrice <= 0}
                  type="button"
                  onClick={() => {
                    if (typeof livePrice === "number" && Number.isFinite(livePrice) && livePrice > 0) {
                      setSpotMode("live");
                      setCurrentPrice(Number(livePrice.toFixed(2)));
                    }
                  }}
                >
                  Use live
                </button>
              </div>

              <div className="xsb-payoff-lab__rows">
                {payoffLegs.map((leg) => (
                  <div className="xsb-payoff-lab__row" key={leg.id}>
                    <select
                      aria-label="Leg side"
                      value={leg.side}
                      onChange={(event) => {
                        const side = event.target.value === "short" ? "short" : "long";
                        setPayoffLegs((prev) =>
                          prev.map((item) => (item.id === leg.id ? { ...item, side } : item))
                        );
                      }}
                    >
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                    <select
                      aria-label="Leg type"
                      value={leg.type}
                      onChange={(event) => {
                        const type = event.target.value === "put" ? "put" : "call";
                        setPayoffLegs((prev) =>
                          prev.map((item) => (item.id === leg.id ? { ...item, type } : item))
                        );
                      }}
                    >
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </select>
                    <input
                      aria-label="Strike"
                      className="xsb-builder-nl-input"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={leg.strike}
                      onChange={(event) => {
                        const strike = normalizeMoneyInput(event.target.value, leg.strike);
                        setPayoffLegs((prev) =>
                          prev.map((item) => (item.id === leg.id ? { ...item, strike } : item))
                        );
                      }}
                    />
                    <input
                      aria-label="Premium"
                      className="xsb-builder-nl-input"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={leg.premium}
                      onChange={(event) => {
                        const premium = normalizeMoneyInput(event.target.value, leg.premium);
                        setPayoffLegs((prev) =>
                          prev.map((item) => (item.id === leg.id ? { ...item, premium } : item))
                        );
                      }}
                    />
                    <input
                      aria-label="Contracts"
                      className="xsb-builder-nl-input"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={leg.quantity}
                      onChange={(event) => {
                        const quantity = Math.max(1, Math.trunc(Number.parseInt(event.target.value, 10) || 1));
                        setPayoffLegs((prev) =>
                          prev.map((item) => (item.id === leg.id ? { ...item, quantity } : item))
                        );
                      }}
                    />
                    <button
                      className="xsb-payoff-lab__delete"
                      type="button"
                      onClick={() => {
                        setPayoffLegs((prev) => prev.filter((item) => item.id !== leg.id));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="xsb-payoff-lab__actions">
                <button
                  className="xsb-engine-cta xsb-engine-cta--ghost"
                  type="button"
                  onClick={() => {
                    setPayoffLegs((prev) =>
                      prev.concat(createLeg({ strike: currentPrice, premium: 2, quantity: 1, type: "call", side: "long" }))
                    );
                  }}
                >
                  Add leg
                </button>
                <button
                  className="xsb-engine-cta xsb-engine-cta--ghost"
                  type="button"
                  onClick={() => {
                    setPayoffLegs(buildTemplateLegs(selectedStrategyId, currentPrice));
                  }}
                >
                  Reset strategy template
                </button>
              </div>

              <OptionsPayoffChart darkMode currentPrice={currentPrice} legs={payoffLegs} />
            </div>
            <div className="xsb-builder-actions xsb-builder-actions--start">
              <Link
                className="xsb-engine-cta"
                href={`/xstrategybuilder/strategy-options?symbol=${encodeURIComponent(selectedSymbol)}${selectedStrategyId ? `&strategyId=${encodeURIComponent(selectedStrategyId)}` : ""}`}
              >
                Open strategy options chain
              </Link>
            </div>
          </div> : null}
        </li>
      </ol>

      <p className="xsb-builder-contract-note">
        Session tool contract: <code className="xsb-inline-code">symbol</code>, optional{" "}
        <code className="xsb-inline-code">outlook</code>, <code className="xsb-inline-code">strategyId</code>,{" "}
        <code className="xsb-inline-code">contractType</code>, <code className="xsb-inline-code">expiration</code>,{" "}
        <code className="xsb-inline-code">maxRows</code> → chain rows and recommendation block — see{" "}
        <code className="xsb-inline-code">atx-docs/design-system/xStrategyBuilder/strategy-engine.md</code>.
      </p>

      <p className="xsb-occ-foot">
        Options involve risk and are not suitable for all investors. Review OCC disclosures before trading.
      </p>
    </div>
  );
}
