"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { XoptionsContractPayoffChart } from "@/app/xoptions/xoptions-contract-payoff-chart";
import { XoptionsGreekCalcExplainer } from "@/app/xoptions/xoptions-greek-calc-explainer";
import { XoptionsPositionReview } from "@/app/xoptions/xoptions-position-review";
import { type StrategyChoiceId, type StrategyStartBasis } from "@/app/xoptions/xoptions-strategy-choice-panels";
import { XoptionsTaxLimitHint } from "@/app/xoptions/xoptions-tax-education-panels";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import {
    getCachedOptionChain,
    makeOptionChainCacheKey,
    setCachedOptionChain
} from "@/lib/xoptions/xoptions-chain-cache";
import {
    chainRowMoneynessClass,
    closestStrikeToSpot,
    filterStrikesBySpotBand,
    formatImpliedVolatilityDisplay,
    sliceStrikesAroundSpot,
    STRIKE_SPOT_BAND_PCT
} from "@/lib/xoptions/xoptions-chain-helpers";
import {
    isPayoffPreviewEnabled,
    isShowGreeksCalcLogicEnabled,
    isTaxEducationEnabled,
    subscribeXoptionsEducationPrefs
} from "@/lib/xoptions/xoptions-education-preferences";
import { resolveXoptionsExpirationForHorizon } from "@/lib/xoptions/xoptions-expiration-default";
import {
    buildXoptionsOrderReview,
    formatXoptionsOrderReviewPlainText,
    type XoptionsOpeningAction
} from "@/lib/xoptions/xoptions-order-preview";

type ChainLeg = {
  last_quote: { bid: number; ask: number };
  open_interest?: number;
  volume?: number;
  /** Percentage, e.g. 35.5 = 35.5% */
  implied_volatility?: number;
  greeks?: {
    delta: number;
    gamma: number;
    theta_per_day: number;
    vega_per_one_percent_iv: number;
  };
} | null;

type ChainRow = {
  strike: number;
  call: ChainLeg;
  put: ChainLeg;
};

type ChainPayload = {
  underlying: string;
  expiration: string;
  stockPrice: number;
  dataSource: string;
  note?: string;
  optionChain: ChainRow[];
  error?: string;
};

type ExpirationsPayload = { underlying: string; expirationDates: string[]; error?: string };

const WEEK_CHIPS: { label: string; days: number }[] = [
  { label: "1 wk", days: 7 },
  { label: "2 wk", days: 14 },
  { label: "4 wk", days: 28 }
];
function legOi(leg: ChainLeg): number {
  if (!leg) return 0;
  const oi = leg.open_interest;
  return typeof oi === "number" && Number.isFinite(oi) ? oi : 0;
}

function filterChainRows(rows: ChainRow[]): ChainRow[] {
  const filtered = rows.filter((r) => legOi(r.call) > 0 || legOi(r.put) > 0);
  return filtered.length > 0 ? filtered : rows;
}

const CHAIN_TABLE_MAX = 80;
const ATM_STRIKE_WINDOW = 9;

function formatExpirationLabel(yyyyMmDd: string): string {
  try {
    const d = new Date(`${yyyyMmDd.slice(0, 10)}T12:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return yyyyMmDd;
  }
}

function breakevenLong(side: "call" | "put", strike: number, premiumPerShare: number): number {
  if (side === "call") return strike + premiumPerShare;
  return Math.max(0, strike - premiumPerShare);
}

export type XoptionsChooseContractProps = {
  symbol: string;
  weeks: number | null;
  onWeeksChange: (w: number | null) => void;
  lastPrice: number | null;
  /** Step 3 strategy label — included in Review order preview text. */
  strategyLabel?: string | null;
  /** Step 3 strategy selection — used to align default side + opening action in review copy. */
  strategyChoiceId?: StrategyChoiceId | null;
  /** Plain-text Review order for xChat handoff; `null` when preview unavailable. */
  onReviewOrderPlainTextChange?: (text: string | null) => void;
  /** Yahoo option contract symbol for selected leg (e.g. TSLA260130C00170000). */
  onYahooOptionSymbolChange?: (symbol: string | null) => void;
  /** Structured selected option metadata for downstream actions (watchlist, filters, etc.). */
  onSelectedOptionMetaChange?: (meta: XoptionsSelectedOptionMeta | null) => void;
  /** Total portfolio value (holdings + cash) for risk context; optional. */
  portfolioApproxValue?: number | null;
  /** Underlying shares held in workspace account, if any. */
  holdingSharesForSymbol?: number | null;
  /** Step 3 cash or share sizing — stock mode prefills contract quantity when empty. */
  strategyStartBasis?: StrategyStartBasis | null;
};

export type XoptionsSelectedOptionMeta = {
  underlying: string;
  expiration: string;
  strike: number;
  side: "call" | "put";
  yahooSymbol: string;
};

function toYahooOptionSymbol(
  underlying: string,
  expirationYyyyMmDd: string,
  contractType: "call" | "put",
  strikePrice: number
): string {
  const expDate = expirationYyyyMmDd.replace(/-/g, "").slice(2);
  const typeChar = contractType === "call" ? "C" : "P";
  const strikeStr = String(Math.round(strikePrice * 1000)).padStart(8, "0");
  return `${underlying}${expDate}${typeChar}${strikeStr}`;
}

function strategyDefaults(input: StrategyChoiceId | null | undefined): {
  side: "call" | "put";
  openingAction: XoptionsOpeningAction;
} | null {
  switch (input) {
    case "covered-call":
    case "buy-write":
      return { side: "call", openingAction: "sell_to_open" };
    case "cash-secured-put":
    case "short-put-spread":
      return { side: "put", openingAction: "sell_to_open" };
    case "long-call":
    case "long-call-spread":
      return { side: "call", openingAction: "buy_to_open" };
    default:
      return null;
  }
}

function ChainSkeleton() {
  return (
    <div className="xoptions-contract-skeleton" aria-hidden>
      <div className="xoptions-mid-three__label mb-2 opacity-60">Option chain</div>
      <div className="xoptions-contract-skeleton__bar xoptions-contract-skeleton__bar--head" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="xoptions-contract-skeleton__row">
          <span className="xoptions-contract-skeleton__cell" />
          <span className="xoptions-contract-skeleton__cell" />
          <span className="xoptions-contract-skeleton__cell" />
          <span className="xoptions-contract-skeleton__cell" />
        </div>
      ))}
    </div>
  );
}

function PayoffSkeleton() {
  return (
    <div className="xoptions-contract-skeleton xoptions-contract-skeleton--payoff" aria-hidden>
      <div className="xoptions-mid-three__label mb-2 opacity-60">Payoff at expiration</div>
      <div className="xoptions-contract-skeleton__payoff-mock">
        <span className="xoptions-contract-skeleton__payoff-loss" />
        <span className="xoptions-contract-skeleton__payoff-gain" />
      </div>
      <p className="xoptions-contract-skeleton__legend-hint mt-2 text-[0.5625rem] text-[var(--xf-text-500)]">
        Strike · Breakeven · Stock price · P/L
      </p>
    </div>
  );
}

function formatGreek(n: number | undefined, digits: number): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }
  return n.toFixed(digits);
}

export function XoptionsChooseContract({
  symbol,
  weeks,
  onWeeksChange,
  lastPrice,
  strategyLabel = null,
  strategyChoiceId = null,
  onReviewOrderPlainTextChange,
  onYahooOptionSymbolChange,
  onSelectedOptionMetaChange,
  portfolioApproxValue = null,
  holdingSharesForSymbol = null,
  strategyStartBasis = null
}: XoptionsChooseContractProps) {
  const u = symbol.trim().toUpperCase();

  const [expirations, setExpirations] = useState<string[]>([]);
  const [expiration, setExpiration] = useState("");
  const [chain, setChain] = useState<ChainPayload | null>(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [side, setSide] = useState<"call" | "put">("call");
  const [showAllStrikes, setShowAllStrikes] = useState(false);
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [limitPrice, setLimitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const strategyDefaultsResolved = useMemo(
    () => strategyDefaults(strategyChoiceId),
    [strategyChoiceId]
  );

  const chainTableScrollRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef(side);
  sideRef.current = side;

  const showGreeksCalcLogic = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    isShowGreeksCalcLogicEnabled,
    () => false
  );
  const taxEducationEnabled = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    isTaxEducationEnabled,
    () => false
  );
  const payoffPreviewEnabled = useSyncExternalStore(
    subscribeXoptionsEducationPrefs,
    isPayoffPreviewEnabled,
    () => false
  );

  useEffect(() => {
    setExpiration("");
    setSelectedStrike(null);
    setLimitPrice("");
    setQuantity("");
    setChain(null);
    setShowAllStrikes(false);
    setError(null);
  }, [u]);

  useEffect(() => {
    if (!strategyStartBasis || strategyStartBasis.mode !== "stock") {
      return;
    }
    const sh = strategyStartBasis.shares;
    if (!Number.isFinite(sh) || sh < 1) {
      return;
    }
    const contracts = Math.max(1, Math.floor(sh / 100));
    setQuantity((q) => (q.trim() === "" ? String(contracts) : q));
  }, [strategyStartBasis, u]);

  useEffect(() => {
    if (!strategyDefaultsResolved) {
      return;
    }
    setSide(strategyDefaultsResolved.side);
  }, [strategyDefaultsResolved]);

  useEffect(() => {
    if (!u) {
      setExpirations([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingExp(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/strategy-options/expirations?underlying=${encodeURIComponent(u)}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as ExpirationsPayload;
        if (!res.ok) {
          throw new Error(json.error ?? "Could not load expirations.");
        }
        const dates = json.expirationDates ?? [];
        if (cancelled) return;
        setExpirations(dates);
        setExpiration((prev) => (prev && dates.includes(prev) ? prev : ""));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Expirations failed.");
        }
      } finally {
        if (!cancelled) setLoadingExp(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [u]);

  useEffect(() => {
    if (!u || !expiration) {
      setChain(null);
      setSelectedStrike(null);
      return;
    }
    let cancelled = false;

    const applyPayload = (payload: ChainPayload) => {
      setChain(payload);
      const rows = filterChainRows(payload.optionChain);
      const spot = payload.stockPrice;
      const s = sideRef.current;
      const strikeList = rows
        .filter((r) => {
          const leg = s === "call" ? r.call : r.put;
          return leg != null;
        })
        .map((r) => r.strike);
      const atm = closestStrikeToSpot(strikeList, spot);
      if (atm != null) {
        setSelectedStrike(atm);
        setQuantity("1");
      } else {
        setSelectedStrike(null);
        setLimitPrice("");
        setQuantity("");
      }
    };

    void (async () => {
      const cacheKey = makeOptionChainCacheKey(u, expiration);
      const cached = getCachedOptionChain(cacheKey);
      if (cached && !cancelled) {
        applyPayload(cached as ChainPayload);
        setLoadingChain(false);
        setError(null);
        return;
      }

      setChain(null);
      setLoadingChain(true);
      setError(null);
      try {
        const strikeParam =
          lastPrice != null && Number.isFinite(lastPrice) && lastPrice > 0
            ? String(lastPrice)
            : "0";
        const qs = new URLSearchParams({
          underlying: u,
          expiration,
          strike: strikeParam
        });
        const res = await fetch(`/api/strategy-options?${qs.toString()}`, {
          credentials: "include"
        });
        const payload = (await res.json()) as ChainPayload & { error?: string };
        if (!res.ok) {
          throw new Error(payload.error ?? "Could not load option chain.");
        }
        if (!cancelled) {
          setCachedOptionChain(cacheKey, payload);
          applyPayload(payload);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Chain load failed.");
          setChain(null);
        }
      } finally {
        if (!cancelled) setLoadingChain(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [u, expiration, lastPrice]);

  const applyWeekHorizon = useCallback(
    (days: number) => {
      onWeeksChange(days);
      if (expirations.length === 0) {
        return;
      }
      const next = resolveXoptionsExpirationForHorizon(expirations, days);
      if (next) {
        setExpiration(next);
      }
    },
    [expirations, onWeeksChange]
  );

  const onExpirationSelectChange = useCallback(
    (value: string) => {
      setExpiration(value);
      onWeeksChange(null);
    },
    [onWeeksChange]
  );

  const baseRows = useMemo(
    () => (chain ? filterChainRows(chain.optionChain) : []),
    [chain]
  );

  const baseRowsInSpotBand = useMemo(() => {
    if (!chain || baseRows.length === 0) return [];
    return filterStrikesBySpotBand(baseRows, chain.stockPrice, STRIKE_SPOT_BAND_PCT);
  }, [chain, baseRows]);

  const strikeOptions = useMemo(() => {
    const source = showAllStrikes ? baseRows : baseRowsInSpotBand;
    const strikes = [...new Set(source.map((r) => r.strike))].sort((a, b) => a - b);
    if (selectedStrike != null && !strikes.includes(selectedStrike)) {
      const has = baseRows.some((r) => r.strike === selectedStrike);
      if (has) {
        return [...strikes, selectedStrike].sort((a, b) => a - b);
      }
    }
    return strikes;
  }, [baseRowsInSpotBand, baseRows, selectedStrike, showAllStrikes]);

  const tableRows = useMemo(() => {
    if (!chain || baseRows.length === 0) return [];
    if (showAllStrikes) {
      return baseRows.slice(0, CHAIN_TABLE_MAX);
    }
    if (baseRowsInSpotBand.length === 0) {
      return [];
    }
    return sliceStrikesAroundSpot(baseRowsInSpotBand, chain.stockPrice, ATM_STRIKE_WINDOW);
  }, [chain, baseRows, baseRowsInSpotBand, showAllStrikes]);

  const tableRowsForDisplay = useMemo(() => {
    if (selectedStrike == null) return tableRows;
    if (tableRows.some((r) => r.strike === selectedStrike)) return tableRows;
    const extra = baseRows.find((r) => r.strike === selectedStrike);
    if (!extra) return tableRows;
    return [...tableRows, extra].sort((a, b) => a.strike - b.strike);
  }, [tableRows, baseRows, selectedStrike]);

  const atmStrike = useMemo(() => {
    if (!chain || tableRowsForDisplay.length === 0) {
      return null;
    }
    return closestStrikeToSpot(
      tableRowsForDisplay.map((r) => r.strike),
      chain.stockPrice
    );
  }, [chain, tableRowsForDisplay]);

  const truncated = showAllStrikes && baseRows.length > CHAIN_TABLE_MAX;

  const selectedRow = useMemo(() => {
    if (!chain || selectedStrike == null) return null;
    return chain.optionChain.find((r) => r.strike === selectedStrike) ?? null;
  }, [chain, selectedStrike]);

  const premiumNum = useMemo(() => {
    const p = parseFloat(limitPrice.trim());
    return Number.isFinite(p) && p >= 0 ? p : 0;
  }, [limitPrice]);

  const limitNum = parseFloat(limitPrice.trim());
  const limitOk = limitPrice.trim() !== "" && Number.isFinite(limitNum) && limitNum >= 0;
  const qtyNum = parseInt(quantity, 10);
  const qtyOk = quantity.trim() !== "" && Number.isFinite(qtyNum) && qtyNum >= 1;

  const dataReady = Boolean(
    expiration && selectedStrike != null && limitOk && qtyOk
  );

  const orderReview = useMemo(() => {
    if (!dataReady || !chain || selectedStrike == null || !expiration) {
      return null;
    }
    const row = chain.optionChain.find((r) => r.strike === selectedStrike);
    const leg = row ? (side === "call" ? row.call : row.put) : null;
    return buildXoptionsOrderReview({
      symbol: u,
      expirationYyyyMmDd: expiration,
      side,
      openingAction: strategyDefaultsResolved?.openingAction ?? "buy_to_open",
      strike: selectedStrike,
      limitPrice: limitPrice.trim(),
      quantity: quantity.trim(),
      spot: chain.stockPrice,
      impliedVolatilityPercent: leg?.implied_volatility,
      strategyLabel,
      legDelta: leg?.greeks?.delta ?? null
    });
  }, [
    dataReady,
    chain,
    selectedStrike,
    expiration,
    side,
    strategyDefaultsResolved,
    limitPrice,
    quantity,
    u,
    strategyLabel
  ]);

  const riskScorePercent = useMemo(() => {
    const cap = orderReview?.maxLossUsd;
    if (cap == null || portfolioApproxValue == null || portfolioApproxValue <= 0) {
      return null;
    }
    return Math.min(100, (cap / portfolioApproxValue) * 100);
  }, [orderReview?.maxLossUsd, portfolioApproxValue]);
  const yahooOptionSymbol = useMemo(() => {
    if (!chain || !expiration || selectedStrike == null || !u) {
      return null;
    }
    return toYahooOptionSymbol(u, expiration, side, selectedStrike);
  }, [chain, expiration, selectedStrike, side, u]);
  const selectedOptionMeta = useMemo<XoptionsSelectedOptionMeta | null>(() => {
    if (!yahooOptionSymbol || !expiration || selectedStrike == null || !u) {
      return null;
    }
    return {
      underlying: u,
      expiration,
      strike: selectedStrike,
      side,
      yahooSymbol: yahooOptionSymbol
    };
  }, [yahooOptionSymbol, expiration, selectedStrike, side, u]);

  useEffect(() => {
    onReviewOrderPlainTextChange?.(
      orderReview ? formatXoptionsOrderReviewPlainText(orderReview, { includeFootnote: false }) : null
    );
  }, [orderReview, onReviewOrderPlainTextChange]);

  useEffect(() => {
    onYahooOptionSymbolChange?.(yahooOptionSymbol);
  }, [onYahooOptionSymbolChange, yahooOptionSymbol]);
  useEffect(() => {
    onSelectedOptionMetaChange?.(selectedOptionMeta);
  }, [onSelectedOptionMetaChange, selectedOptionMeta]);

  /** Chain table is interactive once an expiration is chosen and quotes loaded. */
  const chainDataVisible = Boolean(expiration && chain && !loadingChain);
  const chainPanelLocked = !chainDataVisible;

  /** Payoff chart stays gated until strike + limit + quantity are set. */
  const payoffPanelLocked =
    !dataReady || (Boolean(expiration) && loadingChain);

  const syncLimitFromBid = useCallback(
    (strike: number) => {
      if (!chain) return;
      const row = chain.optionChain.find((r) => r.strike === strike);
      const leg = row ? (side === "call" ? row.call : row.put) : null;
      if (leg?.last_quote && Number.isFinite(leg.last_quote.bid)) {
        setLimitPrice(leg.last_quote.bid.toFixed(2));
      }
    },
    [chain, side]
  );

  useEffect(() => {
    if (!chain || selectedStrike == null) return;
    syncLimitFromBid(selectedStrike);
  }, [chain, side, selectedStrike, syncLimitFromBid]);

  useEffect(() => {
    if (selectedStrike == null) return;
    const id = requestAnimationFrame(() => {
      const root = chainTableScrollRef.current;
      if (!root) return;
      const el = root.querySelector(`[data-xo-strike="${selectedStrike}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedStrike, tableRowsForDisplay, chain]);

  const selectRow = useCallback((strike: number) => {
    setSelectedStrike(strike);
  }, []);

  const overlayChecklist = (
    <ul className="xoptions-contract-overlay__list">
      <li className={expiration ? "xoptions-contract-overlay__li--done" : ""}>
        Pick a horizon chip or an expiration date (chain loads after this)
      </li>
      <li className={selectedStrike != null ? "xoptions-contract-overlay__li--done" : ""}>
        Select a strike price
      </li>
      <li className={limitOk ? "xoptions-contract-overlay__li--done" : ""}>
        Select or enter a limit price (use bid or type)
      </li>
      <li className={qtyOk ? "xoptions-contract-overlay__li--done" : ""}>Enter quantity</li>
    </ul>
  );

  return (
    <section className="xoptions-contract" aria-label="Choose contract">
      <div className="xoptions-contract__horizon mb-3 pb-3">
        <p className="xoptions-top-option-header__label">Target expiration</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {WEEK_CHIPS.map((w) => (
            <button
              key={w.days}
              type="button"
              className={`xoptions-choice ${weeks !== null && weeks === w.days ? "xoptions-choice--active" : ""}`}
              disabled={loadingExp || expirations.length === 0}
              onClick={() => applyWeekHorizon(w.days)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <p className="xoptions-hint mt-1 text-xs">
          {weeks == null
            ? "Choose a horizon chip or an expiration below — the chain loads only after you pick one."
            : `~${weeks}d horizon — adjust expiration below if needed.`}
        </p>
      </div>

      <div className="xoptions-contract__controls">
        <div className="xoptions-contract__controls-row xoptions-contract__controls-row--all">
          <div className="xoptions-contract__control">
            <label className="xoptions-contract__label" htmlFor="xo-contract-symbol">
              Symbol
            </label>
            <p id="xo-contract-symbol" className="xoptions-contract__symbol-val font-mono">
              {u || "—"}
            </p>
          </div>

          <div className="xoptions-contract__control">
            <label className="xoptions-contract__label" htmlFor="xo-contract-exp">
              Expiration
            </label>
            <select
              id="xo-contract-exp"
              className="crud-input xoptions-contract__input mt-0.5 w-full font-mono text-sm"
              value={expiration}
              disabled={loadingExp || expirations.length === 0}
              onChange={(e) => onExpirationSelectChange(e.target.value)}
            >
              <option value="">{loadingExp ? "Loading…" : "Choose expiration to load chain"}</option>
              {expirations.map((d) => (
                <option key={d} value={d}>
                  {formatExpirationLabel(d)}
                </option>
              ))}
            </select>
            <a className="xoptions-contract__help" href="/xstrategybuilder/strategy-options">
              How to pick an expiration date
            </a>
          </div>

          <div className="xoptions-contract__control">
            <label className="xoptions-contract__label" htmlFor="xo-contract-strike">
              Strike
            </label>
            <select
              id="xo-contract-strike"
              className="crud-input xoptions-contract__input mt-0.5 w-full font-mono text-sm"
              value={selectedStrike ?? ""}
              disabled={loadingExp || loadingChain || strikeOptions.length === 0}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setSelectedStrike(null);
                  setLimitPrice("");
                  return;
                }
                setSelectedStrike(Number(v));
              }}
            >
              <option value="">Select</option>
              {strikeOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <p className="xoptions-contract__strike-hint">
              ±{(STRIKE_SPOT_BAND_PCT * 100).toFixed(0)}% spot
              {chain ? ` (${chain.stockPrice.toFixed(2)})` : ""} · Full chain: show all below
            </p>
            <a className="xoptions-contract__help" href="/xstrategybuilder/strategy-options">
              How to pick a strike price
            </a>
          </div>

          <div className="xoptions-contract__control">
            <label className="xoptions-contract__label" htmlFor="xo-contract-limit">
              Limit price
            </label>
            <input
              id="xo-contract-limit"
              type="text"
              inputMode="decimal"
              className="crud-input xoptions-contract__input mt-0.5 w-full font-mono text-sm"
              placeholder="Limit $"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              aria-label="Limit price per share"
            />
            {taxEducationEnabled ? <XoptionsTaxLimitHint /> : null}
            <a className="xoptions-contract__help" href="/xstrategybuilder/strategy-options">
              How to pick a limit price
            </a>
          </div>

          <div className="xoptions-contract__control">
            <label className="xoptions-contract__label" htmlFor="xo-contract-qty">
              Quantity
            </label>
            <input
              id="xo-contract-qty"
              type="text"
              inputMode="numeric"
              className="crud-input xoptions-contract__input mt-0.5 w-full font-mono text-sm"
              placeholder="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ""))}
              aria-label="Contracts quantity"
            />
            {strategyStartBasis?.mode === "cash" ? (
              <p className="xoptions-hint mt-1 text-[0.65rem] text-[var(--xf-text-400)]">
                Rough budget from step 3:{" "}
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0
                }).format(strategyStartBasis.usd)}
                . Adjust contracts to match risk.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {chain ? (
        <div className="xoptions-contract__filters">
          <div className="xoptions-contract__side" role="group" aria-label="Calls or puts">
            <button
              type="button"
              className={`xoptions-contract__side-btn ${side === "call" ? "xoptions-contract__side-btn--active" : ""}`}
              onClick={() => setSide("call")}
            >
              Calls
            </button>
            <button
              type="button"
              className={`xoptions-contract__side-btn ${side === "put" ? "xoptions-contract__side-btn--active" : ""}`}
              onClick={() => setSide("put")}
            >
              Puts
            </button>
          </div>
          <label className="xoptions-contract__show-all">
            <input
              type="checkbox"
              checked={showAllStrikes}
              onChange={(e) => setShowAllStrikes(e.target.checked)}
            />
            <span>Show all strike prices</span>
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="xoptions-alert mb-2" role="alert">
          {error}
        </p>
      ) : null}

      {u ? (
        <div
          className={`xoptions-contract__split${!payoffPreviewEnabled ? " xoptions-contract__split--no-aside" : ""}`}
        >
          <div className="xoptions-contract__split-main">
            <div
              className={`xoptions-contract__grid${!payoffPreviewEnabled ? " xoptions-contract__grid--no-payoff" : ""}`}
            >
          <div className="xoptions-contract__chain-wrap relative min-w-0">
            <div
              className={`xoptions-contract__panel-inner ${chainPanelLocked ? "xoptions-contract__panel-inner--locked" : ""}`}
            >
              {chain ? (
                <>
                  <p className="xoptions-mid-three__label mb-1">
                    Option chain · {side === "call" ? "Calls" : "Puts"} · spot{" "}
                    <span className="font-mono">{chain.stockPrice.toFixed(2)}</span>
                  </p>
                  <div
                    className={
                      showGreeksCalcLogic
                        ? "xoptions-contract__chain-and-greek-help"
                        : "xoptions-contract__chain-and-greek-help xoptions-contract__chain-and-greek-help--table-only"
                    }
                  >
                    {showGreeksCalcLogic ? (
                      <div className="xoptions-contract__greek-help-col min-w-0 max-lg:order-2">
                        <XoptionsGreekCalcExplainer />
                      </div>
                    ) : null}
                    <div ref={chainTableScrollRef} className="xoptions-contract__table-scroll min-w-0">
                    <table className="xoptions-chain-table xoptions-chain-table--compact w-full min-w-[48rem] border-collapse text-left text-[0.6rem]">
                      <thead>
                        <tr className="xoptions-chain-table__head">
                          <th className="py-1 pr-1 font-semibold w-8" />
                          <th className="py-1 pr-1 font-semibold" title="Strike price">
                            Strike
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Best bid per share">
                            Bid
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Best ask per share">
                            Ask
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Breakeven at expiration using bid/ask mid">
                            BE
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Implied volatility (annualized)">
                            IV%
                          </th>
                          <th className="py-1 pr-1 font-semibold text-right" title="Contract volume">
                            Vol
                          </th>
                          <th className="py-1 pr-1 font-semibold text-right" title="Open interest">
                            OI
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Delta per share">
                            Δ
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Gamma per share">
                            Γ
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Theta per day per share (model)">
                            Θ/day
                          </th>
                          <th className="py-1 pr-1 font-semibold" title="Vega per 1 percentage-point IV move">
                            Vega
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRowsForDisplay.map((row) => {
                          const leg = side === "call" ? row.call : row.put;
                          const spot = chain.stockPrice;
                          const moneynessClass = chainRowMoneynessClass(row.strike, spot, side, atmStrike);
                          if (!leg) {
                            return (
                              <tr
                                key={row.strike}
                                className="xoptions-chain-table__row"
                                data-xo-strike={row.strike}
                              >
                                <td colSpan={12} className="py-0.5 xoptions-chain-table__empty">
                                  {row.strike} — no quote
                                </td>
                              </tr>
                            );
                          }
                          const bid = leg.last_quote.bid;
                          const ask = leg.last_quote.ask;
                          const mid = (bid + ask) / 2;
                          const be = breakevenLong(side, row.strike, mid);
                          const selected = selectedStrike === row.strike;
                          const ivDisplay = formatImpliedVolatilityDisplay(leg.implied_volatility);
                          const vol =
                            typeof leg.volume === "number" && Number.isFinite(leg.volume)
                              ? leg.volume
                              : 0;
                          const g = leg.greeks;
                          return (
                            <tr
                              key={row.strike}
                              data-xo-strike={row.strike}
                              className={`xoptions-chain-table__row ${moneynessClass} ${selected ? "xoptions-contract-row--selected" : ""}`}
                            >
                              <td className="py-0.5 pr-1">
                                <input
                                  type="radio"
                                  name="xo-contract-strike-row"
                                  className="xoptions-contract__radio"
                                  checked={selected}
                                  onChange={() => selectRow(row.strike)}
                                  aria-label={`Strike ${row.strike}`}
                                />
                              </td>
                              <td className="py-0.5 pr-1 font-mono xoptions-chain-table__strike">{row.strike}</td>
                              <td className="py-0.5 pr-1">
                                <button
                                  type="button"
                                  className="xoptions-contract__bid font-mono"
                                  onClick={() => {
                                    setSelectedStrike(row.strike);
                                    syncLimitFromBid(row.strike);
                                  }}
                                >
                                  ${bid.toFixed(2)}
                                </button>
                              </td>
                              <td className="py-0.5 pr-1 font-mono">${ask.toFixed(2)}</td>
                              <td className="py-0.5 pr-1 font-mono">${be.toFixed(2)}</td>
                              <td className="py-0.5 pr-1 font-mono">{ivDisplay}</td>
                              <td className="py-0.5 pr-1 font-mono text-right tabular-nums">
                                {vol.toLocaleString()}
                              </td>
                              <td className="py-0.5 pr-1 font-mono text-right tabular-nums">
                                {legOi(leg).toLocaleString()}
                              </td>
                              <td className="py-0.5 pr-1 font-mono tabular-nums">{formatGreek(g?.delta, 3)}</td>
                              <td className="py-0.5 pr-1 font-mono tabular-nums">{formatGreek(g?.gamma, 4)}</td>
                              <td className="py-0.5 pr-1 font-mono tabular-nums">{formatGreek(g?.theta_per_day, 3)}</td>
                              <td className="py-0.5 pr-1 font-mono tabular-nums">{formatGreek(g?.vega_per_one_percent_iv, 3)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </div>
                  {truncated ? (
                    <p className="xoptions-chain-scanner__warn mt-1 text-xs">
                      Showing first {CHAIN_TABLE_MAX} strikes ({baseRows.length} loaded).
                    </p>
                  ) : null}
                  <p className="xoptions-contract__chain-foot mt-2">
                    <a className="xoptions-text-link" href="/xstrategybuilder/strategy-options">
                      How to read the option chain
                    </a>
                    <span className="xoptions-contract__moneyness-legend text-xs text-[var(--xf-text-400)]">
                      <span className="inline-flex items-center gap-1">
                        <span className="xoptions-contract__atm-swatch" aria-hidden /> ATM
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="xoptions-contract__itm-swatch" aria-hidden /> ITM
                      </span>
                    </span>
                  </p>
                </>
              ) : (
                <ChainSkeleton />
              )}
            </div>
            {chainPanelLocked ? (
              <div
                className="xoptions-contract-overlay xoptions-contract-overlay--card"
                role="status"
                aria-live="polite"
              >
                <div className="xoptions-contract-overlay__card">
                  {loadingChain && expiration ? (
                    <p className="xoptions-contract-overlay__loading m-0 text-sm text-[var(--xf-text-300)]">
                      Loading chain…
                    </p>
                  ) : (
                    overlayChecklist
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {payoffPreviewEnabled ? (
            <div className="xoptions-contract__payoff relative min-w-0">
              <details className="xoptions-payoff-card rounded-[var(--xf-radius-sm)] border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)]">
                <summary className="xoptions-payoff-card__summary flex w-full cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-semibold text-[var(--xf-text-200)] outline-none marker:content-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)]">
                  <span>Payoff preview</span>
                  <span className="xoptions-payoff-card__chev text-[var(--xf-text-400)]" aria-hidden>
                    ▾
                  </span>
                </summary>
                <div className="xoptions-payoff-card__body relative border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] p-2 pt-3">
                  <div
                    className={`xoptions-contract__panel-inner ${payoffPanelLocked ? "xoptions-contract__panel-inner--locked" : ""}`}
                  >
                    {chain && selectedRow && dataReady ? (
                      <XoptionsContractPayoffChart
                        side={side}
                        strike={selectedRow.strike}
                        premium={premiumNum}
                        spot={chain.stockPrice}
                        ivPercent={
                          (side === "call"
                            ? selectedRow.call?.implied_volatility
                            : selectedRow.put?.implied_volatility) ?? null
                        }
                        expirationYyyyMmDd={expiration}
                        openingAction={strategyDefaultsResolved?.openingAction ?? "buy_to_open"}
                        cappedUpsideLabel={orderReview?.cappedUpsideDisplay ?? null}
                      />
                    ) : (
                      <>
                        <PayoffSkeleton />
                        <a
                          className="xoptions-text-link mt-2 inline-block"
                          href="/xstrategybuilder/strategy-options"
                        >
                          How to read the graph
                        </a>
                      </>
                    )}
                  </div>
                  {payoffPanelLocked ? (
                    <div
                      className="xoptions-contract-overlay xoptions-contract-overlay--card"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="xoptions-contract-overlay__card">
                        {loadingChain && expiration ? (
                          <p className="xoptions-contract-overlay__loading m-0 text-sm text-[var(--xf-text-300)]">
                            Loading chain…
                          </p>
                        ) : (
                          overlayChecklist
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          ) : null}
        </div>
            {orderReview && !payoffPreviewEnabled ? (
              <div
                className="xoptions-contract__review-below mt-3 min-w-0"
                aria-label="Position review"
              >
                <XoptionsPositionReview
                  orderReview={orderReview}
                  underlying={u}
                  strategyChoiceId={strategyChoiceId}
                  strategyLabel={strategyLabel}
                  openingAction={strategyDefaultsResolved?.openingAction ?? "buy_to_open"}
                  riskScorePercent={riskScorePercent}
                  portfolioApproxValue={portfolioApproxValue}
                  taxEducationEnabled={taxEducationEnabled}
                  holdingSharesForSymbol={holdingSharesForSymbol}
                  yahooOptionSymbol={yahooOptionSymbol}
                />
              </div>
            ) : null}
            </div>
          {orderReview && payoffPreviewEnabled ? (
            <aside className="xoptions-contract__split-aside" aria-label="Position review">
              <XoptionsPositionReview
                orderReview={orderReview}
                underlying={u}
                strategyChoiceId={strategyChoiceId}
                strategyLabel={strategyLabel}
                openingAction={strategyDefaultsResolved?.openingAction ?? "buy_to_open"}
                riskScorePercent={riskScorePercent}
                portfolioApproxValue={portfolioApproxValue}
                taxEducationEnabled={taxEducationEnabled}
                holdingSharesForSymbol={holdingSharesForSymbol}
                yahooOptionSymbol={yahooOptionSymbol}
              />
            </aside>
          ) : null}
        </div>
      ) : (
        <p className="xoptions-hint text-sm">Enter a symbol in step 1.</p>
      )}

      <p className="xoptions-contract__disclaimer mt-3 text-[0.65rem] leading-snug text-[var(--xf-text-500)]">
        Payoff BE uses model mid; review uses your limit. {EDUCATIONAL_ONLY_SHORT}
      </p>
    </section>
  );
}
