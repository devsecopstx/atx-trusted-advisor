"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { XoptionsContractPayoffChart } from "@/app/xoptions/xoptions-contract-payoff-chart";
import { XoptionsReviewOrderSummaryBar } from "@/app/xoptions/xoptions-review-order-summary-bar";
import type { StrategyChoiceId } from "@/app/xoptions/xoptions-strategy-choice-panels";
import {
    addCalendarDaysUtc,
    chainRowMoneynessClass,
    closestStrikeToSpot,
    filterStrikesBySpotBand,
    formatImpliedVolatilityDisplay,
    pickExpirationOnOrAfter,
    sliceStrikesAroundSpot,
    STRIKE_SPOT_BAND_PCT
} from "@/lib/xoptions/xoptions-chain-helpers";
import {
    buildXoptionsOrderReview,
    formatXoptionsOrderReviewPlainText,
    XOPTIONS_REVIEW_ORDER_FOOTNOTE,
    type XoptionsOpeningAction
} from "@/lib/xoptions/xoptions-order-preview";

type ChainLeg = {
  last_quote: { bid: number; ask: number };
  open_interest?: number;
  /** Percentage, e.g. 35.5 = 35.5% */
  implied_volatility?: number;
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

function defaultExpirationForHorizon(dates: string[], weeks: number): string {
  if (dates.length === 0) return "";
  const sorted = [...new Set(dates)].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  if (weeks > 0) {
    const t = addCalendarDaysUtc(new Date(), weeks);
    return pickExpirationOnOrAfter(sorted, t) ?? sorted[sorted.length - 1] ?? "";
  }
  return pickExpirationOnOrAfter(sorted, new Date()) ?? sorted[0] ?? "";
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
};

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

export function XoptionsChooseContract({
  symbol,
  weeks,
  onWeeksChange,
  lastPrice,
  strategyLabel = null,
  strategyChoiceId = null,
  onReviewOrderPlainTextChange
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
    void (async () => {
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
      if (expirations.length === 0) return;
      const next = defaultExpirationForHorizon(expirations, days);
      if (next) setExpiration(next);
    },
    [expirations, onWeeksChange]
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
      strategyLabel
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

  useEffect(() => {
    onReviewOrderPlainTextChange?.(
      orderReview ? formatXoptionsOrderReviewPlainText(orderReview, { includeFootnote: false }) : null
    );
  }, [orderReview, onReviewOrderPlainTextChange]);

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
        Select an expiration date
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
            ? "Optional: pick a horizon to suggest an expiration in the dropdown."
            : `~${weeks}d horizon — adjust expiration below.`}
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
              onChange={(e) => setExpiration(e.target.value)}
            >
              <option value="">{loadingExp ? "Loading…" : "Select"}</option>
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
        <div className="xoptions-contract__grid">
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
                  <div ref={chainTableScrollRef} className="xoptions-contract__table-scroll">
                    <table className="xoptions-chain-table w-full min-w-[22rem] border-collapse text-left text-[0.6875rem]">
                      <thead>
                        <tr className="xoptions-chain-table__head">
                          <th className="py-1 pr-1 font-semibold w-8" />
                          <th className="py-1 pr-2 font-semibold">Strike</th>
                          <th className="py-1 pr-2 font-semibold">Bid</th>
                          <th className="py-1 pr-2 font-semibold">BE</th>
                          <th className="py-1 pr-2 font-semibold">IV%</th>
                          <th className="py-1 pl-2 font-semibold text-right">OI</th>
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
                                <td colSpan={6} className="py-0.5 xoptions-chain-table__empty">
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
                              <td className="py-0.5 pr-2 font-mono xoptions-chain-table__strike">{row.strike}</td>
                              <td className="py-0.5 pr-2">
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
                              <td className="py-0.5 pr-2 font-mono">${be.toFixed(2)}</td>
                              <td className="py-0.5 pr-2 font-mono">{ivDisplay}</td>
                              <td className="py-0.5 pl-2 font-mono text-right tabular-nums">
                                {legOi(leg).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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

          <div className="xoptions-contract__payoff relative min-w-0">
            <div
              className={`xoptions-contract__panel-inner ${payoffPanelLocked ? "xoptions-contract__panel-inner--locked" : ""}`}
            >
              {chain && selectedRow && dataReady ? (
                <>
                  <p className="xoptions-mid-three__label mb-1">Payoff at expiration</p>
                  <XoptionsContractPayoffChart
                    side={side}
                    strike={selectedRow.strike}
                    premium={premiumNum}
                    spot={chain.stockPrice}
                  />
                </>
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
        </div>
      ) : (
        <p className="xoptions-hint text-sm">Enter a symbol in step 1.</p>
      )}

      {u && orderReview ? (
        <div
          className="xoptions-review-order mt-4 rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)] p-3"
          aria-labelledby="xo-review-order-title"
          data-order-text-preview
        >
          <h3 id="xo-review-order-title" className="xoptions-mid-three__label mb-3">
            Review order
          </h3>
          <div className="mb-3">
            <XoptionsReviewOrderSummaryBar
              bidDisplay={orderReview.bidPerShareDisplay}
              beDisplay={orderReview.breakevenDisplay}
              probDisplay={orderReview.probabilityOtmDisplay}
              probPercent={orderReview.probabilityOtmPercent}
            />
          </div>
          <div className="xoptions-review-order__info">
            <p className="xoptions-review-order__narrative m-0 text-[0.75rem] leading-relaxed text-[var(--xf-text-200)]">
              {orderReview.narrative}
            </p>
            <p className="xoptions-review-order__footnote mt-2 mb-0 text-[0.625rem] text-[var(--xf-text-500)]">
              {XOPTIONS_REVIEW_ORDER_FOOTNOTE}
            </p>
          </div>
        </div>
      ) : null}

      <p className="xoptions-contract__disclaimer mt-3 text-xs text-[var(--xf-text-400)]">
        * Payoff chart BE uses bid/ask mid; Review order BE and debit use your limit price. Not
        financial advice.
      </p>
    </section>
  );
}
