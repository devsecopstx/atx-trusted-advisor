"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { useSymbolQuotes } from "@/app/portfolio/ui/use-symbol-quotes";
import { OptionsPayoffChart } from "@/app/xstrategybuilder/ui/options-payoff-chart";
import type { OptionsPayoffLeg } from "@/lib/options-payoff";
import {
    INVESTMENT_STRATEGY_OPTIONS,
    RISK_LEVEL_OPTIONS
} from "@/modules/core-admin/portfolio-preference-labels";

import { useWorkspaceAccountSelection } from "@/app/ui/use-workspace-account-selection";

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

/** Trade-time stance for this symbol (builder step), distinct from account desk outlook. */
export type TradeOutlook = "bullish" | "neutral" | "bearish";

const WIZARD_STEPS = [
  { id: "symbol" as const, label: "Symbol" },
  { id: "outlook" as const, label: "Outlook" },
  { id: "strategy" as const, label: "Strategy" },
  { id: "fit" as const, label: "Portfolio fit" },
  { id: "legs" as const, label: "Legs & P/L" }
];

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

function tradeOutlookDisplay(o: TradeOutlook): string {
  switch (o) {
    case "bullish":
      return "Bullish / up";
    case "bearish":
      return "Bearish / down";
    default:
      return "Neutral / flat";
  }
}

export type XstrategybuilderPublicPreviewProps = {
  initialWorkspace: XsbInitialWorkspace;
};

export function XstrategybuilderPublicPreview({ initialWorkspace }: XstrategybuilderPublicPreviewProps) {
  const router = useRouter();

  const portfolio: XsbWorkspacePortfolio | null =
    initialWorkspace.status === "ready" ? initialWorkspace.portfolio : null;

  const accounts = useMemo(() => portfolio?.accounts ?? [], [portfolio]);
  const portfolioId = portfolio?._id;
  const accountValidIds = useMemo(
    () => accounts.map((a) => a._id).filter((id): id is string => Boolean(id && id.length > 0)),
    [accounts]
  );
  const serverDefaultAccountId = useMemo(() => {
    const d = accounts.find((a) => a.isDefault)?._id;
    return d ?? accounts[0]?._id ?? null;
  }, [accounts]);
  const selectedAccountId = useWorkspaceAccountSelection(portfolioId, accountValidIds, serverDefaultAccountId);

  const activeAccount = useMemo(
    () => (selectedAccountId ? accounts.find((a) => a._id === selectedAccountId) ?? null : null),
    [accounts, selectedAccountId]
  );

  const [wizardIndex, setWizardIndex] = useState(0);
  const [nlDraft, setNlDraft] = useState("");
  const [tradeOutlook, setTradeOutlook] = useState<TradeOutlook>("bullish");

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
  const canContinueFromStep2 = Boolean(selectedSymbol) && Boolean(selectedAccountId);
  const canContinueFromStep3 = canContinueFromStep2 && Boolean(selectedStrategyId);
  const [currentPrice, setCurrentPrice] = useState<number>(SYMBOL_SPOT_HINTS.TSLA);
  const [spotMode, setSpotMode] = useState<SpotMode>("live");
  const [payoffLegs, setPayoffLegs] = useState<OptionsPayoffLeg[]>(() =>
    buildTemplateLegs(null, SYMBOL_SPOT_HINTS.TSLA)
  );
  const { quotes: liveQuotes, loading: quoteLoading } = useSymbolQuotes([selectedSymbol], { refreshMs: 30_000 });
  const livePrice = liveQuotes[selectedSymbol]?.price;
  const effectiveCurrentPrice = useMemo(() => {
    if (spotMode !== "live") {
      return currentPrice;
    }
    if (typeof livePrice !== "number" || !Number.isFinite(livePrice) || livePrice <= 0) {
      return currentPrice;
    }
    return Number(livePrice.toFixed(2));
  }, [spotMode, livePrice, currentPrice]);
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
      { label: "-15%", value: effectiveCurrentPrice * 0.85 },
      { label: "-10%", value: effectiveCurrentPrice * 0.9 },
      { label: "-5%", value: effectiveCurrentPrice * 0.95 },
      { label: "+5%", value: effectiveCurrentPrice * 1.05 },
      { label: "+10%", value: effectiveCurrentPrice * 1.1 },
      { label: "+15%", value: effectiveCurrentPrice * 1.15 }
    ],
    [effectiveCurrentPrice]
  );

  const money = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }),
    []
  );

  const wizardStepId = WIZARD_STEPS[wizardIndex]?.id ?? "symbol";

  return (
    <div
      aria-label="xStrategyBuilder — OptionsStrategyEngine guided steps (preview)"
      className="xsb-builder-preview xsb-builder-preview--friendly"
      role="region"
    >
      <div className="xsb-wizard-nl">
        <label className="xsb-wizard-nl__label" htmlFor="xsb-nl-order">
          Describe your order (optional)
        </label>
        <input
          id="xsb-nl-order"
          className="xsb-builder-nl-input xsb-builder-nl-input--wide"
          placeholder="Describe your order in plain language"
          value={nlDraft}
          onChange={(e) => setNlDraft(e.target.value)}
          autoComplete="off"
        />
      </div>

      <nav className="xsb-wizard-tabs" aria-label="xStrategyBuilder steps">
        {WIZARD_STEPS.map((step, i) => {
          const done = i < wizardIndex;
          const active = i === wizardIndex;
          return (
            <button
              key={step.id}
              type="button"
              className={`xsb-wizard-tab${active ? " xsb-wizard-tab--active" : ""}${done ? " xsb-wizard-tab--done" : ""}`}
              onClick={() => setWizardIndex(i)}
            >
              {done ? <span aria-hidden>✓ </span> : null}
              {step.label}
            </button>
          );
        })}
      </nav>

      <p className="xsb-wizard-context-line">
        <span className="xsb-wizard-context-k">{selectedSymbol}</span>{" "}
        <span className="xsb-wizard-context-v">{money.format(effectiveCurrentPrice)}</span>
        <span className="xsb-wizard-context-sep">·</span>
        Outlook: <strong>{tradeOutlookDisplay(tradeOutlook)}</strong>
        {selectedStrategy ? (
          <>
            <span className="xsb-wizard-context-sep">·</span>
            Strategy: <strong>{selectedStrategy.label}</strong>
          </>
        ) : null}
        {activeAccount ? (
          <>
            <span className="xsb-wizard-context-sep">·</span>
            Book: <strong>{activeAccount.name}</strong> — risk {riskLabel(activeAccount)}, desk {outlookLabel(activeAccount)}
          </>
        ) : null}
      </p>

      {accounts.length > 1 ? (
        <div className="xsb-account-callout" role="status">
          <strong>Workspace account required.</strong> Pick the custodian account in the <strong>left rail</strong>{" "}
          (defaults to your primary book). Strategy scoring uses that account&apos;s risk and outlook.
        </div>
      ) : null}

      {wizardStepId === "symbol" ? (
        <div className="xsb-wizard-panel">
          <h3 className="xsb-wizard-panel__title">Step 1 — Symbol &amp; book context</h3>

          {initialWorkspace.status === "error" ? (
            <div className="xsb-friendly-error xsb-friendly-error--block">
              <p>{initialWorkspace.message}</p>
              <button className="xsb-friendly-retry" onClick={() => router.refresh()} type="button">
                <RefreshIcon className="crud-icon" />
                Reload page
              </button>
            </div>
          ) : null}

          {!selectedAccountId && portfolio && accounts.length > 0 ? (
            <p className="xsb-friendly-hint xsb-friendly-hint--tight">
              Select an account in the left rail to anchor this builder to a custodian book.
            </p>
          ) : null}

          {accounts.length === 0 && portfolio ? (
            <p className="xsb-friendly-hint">
              No custodian accounts linked yet. Add accounts from{" "}
              <a className="xsb-friendly-link" href="/portfolio">
                Portfolio
              </a>
              .
            </p>
          ) : null}

          {activeAccount ? (
            <section className="xsb-account-context-card" aria-label="Selected account outlook and risk">
              <div className="xsb-account-context-card__head">
                <span className="xsb-account-context-card__name">{activeAccount.name}</span>
                {activeAccount.accountRef ? (
                  <span className="xsb-account-context-card__ref">{activeAccount.accountRef}</span>
                ) : null}
              </div>
              <dl className="xsb-account-context-card__dl">
                <div>
                  <dt>Cash</dt>
                  <dd>{money.format(activeAccount.balance)}</dd>
                </div>
                <div>
                  <dt>Risk profile</dt>
                  <dd>{riskLabel(activeAccount)}</dd>
                </div>
                <div>
                  <dt>Desk outlook</dt>
                  <dd>{outlookLabel(activeAccount)}</dd>
                </div>
              </dl>
              {hasMissingUserContextSettings ? (
                <p className="xsb-account-context-card__hint">
                  Complete risk and outlook on each account in Portfolio so strategy filters stay deterministic.
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="xsb-price-band" aria-label="Current price and target strike bands">
            <div className="xsb-price-band__left">
              <span className="xsb-price-band__k">Symbol</span>
              <span className="xsb-price-band__v">{selectedSymbol}</span>
              <span className="xsb-price-band__k">Current</span>
              <span className="xsb-price-band__v">{money.format(effectiveCurrentPrice)}</span>
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

          <div className="xsb-builder-panel xsb-builder-panel--friendly">
            <label className="xsb-live-symbol-picker" htmlFor="xsb-live-symbol-query">
              Search symbol
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
                    setCurrentPrice(SYMBOL_SPOT_HINTS[value] ?? effectiveCurrentPrice);
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
                      setCurrentPrice(SYMBOL_SPOT_HINTS[item.symbol] ?? effectiveCurrentPrice);
                    }}
                  >
                    <span className="xsb-live-symbol-item__symbol">{item.symbol}</span>
                    <span className="xsb-live-symbol-item__note">{item.note}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="xsb-builder-watchlist-label">Top from watchlist (CSP / CC volatility)</p>
          <div className="xsb-builder-chips" role="list">
            {symbolUniverse.map((item) => (
              <span key={item.symbol} className="xsb-builder-chip" role="listitem">
                {item.symbol}
              </span>
            ))}
          </div>

          <div className="xsb-wizard-nav">
            <span />
            <button
              type="button"
              className="xsb-engine-cta"
              disabled={!canContinueFromStep2}
              onClick={() => setWizardIndex(1)}
            >
              Next — Outlook
            </button>
          </div>
        </div>
      ) : null}

      {wizardStepId === "outlook" ? (
        <div className="xsb-wizard-panel">
          <h3 className="xsb-wizard-panel__title">Step 2 — Market outlook (this symbol)</h3>
          <p className="xsb-friendly-hint xsb-friendly-hint--tight">
            Distinct from your account&apos;s desk outlook in Portfolio — this is your near-term read on{" "}
            <strong>{selectedSymbol}</strong> for strategy filtering.
          </p>
          <div className="xsb-outlook-grid" role="group" aria-label="Market outlook">
            {(
              [
                { id: "bullish" as const, icon: "↑", label: "Bullish / up" },
                { id: "neutral" as const, icon: "—", label: "Neutral / flat" },
                { id: "bearish" as const, icon: "↓", label: "Bearish / down" }
              ] as const
            ).map((row) => (
              <button
                key={row.id}
                type="button"
                className={`xsb-outlook-btn${tradeOutlook === row.id ? " xsb-outlook-btn--active" : ""}`}
                onClick={() => setTradeOutlook(row.id)}
              >
                <span className="xsb-outlook-btn__icon" aria-hidden>
                  {row.icon}
                </span>
                <span className="xsb-outlook-btn__label">{row.label}</span>
              </button>
            ))}
          </div>
          <div className="xsb-wizard-nav">
            <button type="button" className="xsb-engine-cta xsb-engine-cta--ghost" onClick={() => setWizardIndex(0)}>
              Back
            </button>
            <button type="button" className="xsb-engine-cta" onClick={() => setWizardIndex(2)}>
              Next — Strategy
            </button>
          </div>
        </div>
      ) : null}

      {wizardStepId === "strategy" ? (
        <div className="xsb-wizard-panel">
          <h3 className="xsb-wizard-panel__title">Step 3 — Choose strategy</h3>
          <p className="xsb-friendly-hint xsb-friendly-hint--tight">
            <code className="xsb-inline-code">filterEligibleStrategies</code> uses book risk, desk outlook, and this
            trade outlook before scoring.
          </p>
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
                    setPayoffLegs(buildTemplateLegs(option.id, effectiveCurrentPrice));
                  }}
                >
                  <span className="xsb-live-strategy-item__label">{option.label}</span>
                  <span className="xsb-live-strategy-item__summary">{option.summary}</span>
                </button>
              );
            })}
          </div>
          <p className="xsb-friendly-hint xsb-friendly-hint--tight">
            {selectedStrategy ? (
              <>
                Selected: <strong>{selectedStrategy.label}</strong>.
              </>
            ) : (
              "Select one strategy to continue."
            )}
          </p>
          <div className="xsb-wizard-nav">
            <button type="button" className="xsb-engine-cta xsb-engine-cta--ghost" onClick={() => setWizardIndex(1)}>
              Back
            </button>
            <button
              type="button"
              className="xsb-engine-cta"
              disabled={!canContinueFromStep3}
              onClick={() => setWizardIndex(3)}
            >
              Next — Portfolio fit
            </button>
          </div>
        </div>
      ) : null}

      {wizardStepId === "fit" ? (
        <div className="xsb-wizard-panel">
          <h3 className="xsb-wizard-panel__title">Step 4 — Fit score (portfolio factors)</h3>
          <p className="xsb-friendly-hint xsb-friendly-hint--tight">
            <code className="xsb-inline-code">calculateFitScore</code> — weighted 0–100 from book-level{" "}
            <strong>portfolio scoring factors</strong>. Admins tune weights; defaults match the engine spec.
          </p>
          <p className="xsb-friendly-hint xsb-friendly-hint--tight">
            Scoring runs with safe fallbacks; no score internals are exposed in this preview.
          </p>
          <div className="xsb-wizard-nav">
            <button type="button" className="xsb-engine-cta xsb-engine-cta--ghost" onClick={() => setWizardIndex(2)}>
              Back
            </button>
            <button
              type="button"
              className="xsb-engine-cta"
              disabled={!canContinueFromStep3}
              onClick={() => setWizardIndex(4)}
            >
              Next — Legs &amp; P/L
            </button>
          </div>
        </div>
      ) : null}

      {wizardStepId === "legs" ? (
        <div className="xsb-wizard-panel">
          <h3 className="xsb-wizard-panel__title">Step 5 — Legs, risk / reward, P/L chart</h3>
          <p className="xsb-friendly-hint xsb-friendly-hint--tight">
            Open the live chain console for strikes and expirations matching{" "}
            <code className="xsb-inline-code">xfinance-strategy</code> contracts.
          </p>
          {selectedStrategy ? (
            <p className="xsb-friendly-hint xsb-friendly-hint--tight">
              Active strategy: <strong>{selectedStrategy.label}</strong>.
            </p>
          ) : null}

          <div className="xsb-payoff-lab">
            <div className="xsb-payoff-lab__head">
              <p className="xsb-friendly-section-label">P/L at expiration (preview)</p>
              <label className="xsb-payoff-lab__spot" htmlFor="xsb-payoff-spot">
                Spot
                <input
                  id="xsb-payoff-spot"
                  className="xsb-builder-nl-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={effectiveCurrentPrice}
                  onChange={(event) => {
                    setSpotMode("manual");
                    setCurrentPrice(normalizeMoneyInput(event.target.value, effectiveCurrentPrice));
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
                      setPayoffLegs((prev) => prev.map((item) => (item.id === leg.id ? { ...item, side } : item)));
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
                      setPayoffLegs((prev) => prev.map((item) => (item.id === leg.id ? { ...item, type } : item)));
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
                    prev.concat(
                      createLeg({ strike: effectiveCurrentPrice, premium: 2, quantity: 1, type: "call", side: "long" })
                    )
                  );
                }}
              >
                Add leg
              </button>
              <button
                className="xsb-engine-cta xsb-engine-cta--ghost"
                type="button"
                onClick={() => {
                  setPayoffLegs(buildTemplateLegs(selectedStrategyId, effectiveCurrentPrice));
                }}
              >
                Reset strategy template
              </button>
            </div>

            <OptionsPayoffChart darkMode currentPrice={effectiveCurrentPrice} legs={payoffLegs} />
          </div>

          <div className="xsb-builder-actions xsb-builder-actions--start">
            <Link
              className="xsb-engine-cta"
              href={`/xstrategybuilder/strategy-options?symbol=${encodeURIComponent(selectedSymbol)}&tradeOutlook=${encodeURIComponent(tradeOutlook)}${selectedStrategyId ? `&strategyId=${encodeURIComponent(selectedStrategyId)}` : ""}${selectedAccountId ? `&accountId=${encodeURIComponent(selectedAccountId)}` : ""}`}
            >
              Open strategy options chain
            </Link>
          </div>

          <div className="xsb-wizard-nav">
            <button type="button" className="xsb-engine-cta xsb-engine-cta--ghost" onClick={() => setWizardIndex(3)}>
              Back
            </button>
            <button type="button" className="xsb-engine-cta xsb-engine-cta--ghost" onClick={() => setWizardIndex(0)}>
              Start over
            </button>
          </div>
        </div>
      ) : null}

      <p className="xsb-builder-contract-note">
        Session tool contract: <code className="xsb-inline-code">symbol</code>,{" "}
        <code className="xsb-inline-code">tradeOutlook</code> ({tradeOutlook}), optional{" "}
        <code className="xsb-inline-code">accountId</code>, <code className="xsb-inline-code">strategyId</code>,{" "}
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
