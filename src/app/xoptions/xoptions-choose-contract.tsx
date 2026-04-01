"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { XoptionsContractPayoffChart } from "@/app/xoptions/xoptions-contract-payoff-chart";
import {
    addCalendarDaysUtc,
    otmPercentCall,
    otmPercentPut,
    pickExpirationOnOrAfter,
    sliceStrikesAroundSpot,
    spreadMetrics,
    spreadQuality
} from "@/lib/xoptions/xoptions-chain-helpers";

type ChainLeg = {
  last_quote: { bid: number; ask: number };
  open_interest?: number;
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

function defaultExpirationForHorizon(dates: string[], weeks: number | null): string {
  if (dates.length === 0) return "";
  const sorted = [...new Set(dates)].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  if (weeks != null && weeks > 0) {
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
  lastPrice: number | null;
};

export function XoptionsChooseContract({ symbol, weeks, lastPrice }: XoptionsChooseContractProps) {
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
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    if (!u) {
      setExpirations([]);
      setExpiration("");
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
        setExpiration((prev) => {
          if (prev && dates.includes(prev)) return prev;
          return defaultExpirationForHorizon(dates, weeks);
        });
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
  }, [u, weeks]);

  useEffect(() => {
    if (!u || !expiration) {
      setChain(null);
      setSelectedStrike(null);
      return;
    }
    let cancelled = false;
    void (async () => {
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
          setSelectedStrike(null);
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

  useEffect(() => {
    if (!chain || selectedStrike == null) return;
    const row = chain.optionChain.find((r) => r.strike === selectedStrike);
    const leg = row ? (side === "call" ? row.call : row.put) : null;
    if (!leg) {
      setSelectedStrike(null);
      return;
    }
    const bid = leg.last_quote.bid;
    const ask = leg.last_quote.ask;
    const mid = (bid + ask) / 2;
    if (Number.isFinite(mid)) {
      setLimitPrice(mid.toFixed(2));
    }
  }, [chain, selectedStrike, side]);

  const baseRows = useMemo(
    () => (chain ? filterChainRows(chain.optionChain) : []),
    [chain]
  );

  const strikeOptions = useMemo(() => {
    const strikes = [...new Set(baseRows.map((r) => r.strike))].sort((a, b) => a - b);
    return strikes;
  }, [baseRows]);

  const tableRows = useMemo(() => {
    if (!chain || baseRows.length === 0) return [];
    if (showAllStrikes) {
      return baseRows.slice(0, CHAIN_TABLE_MAX);
    }
    return sliceStrikesAroundSpot(baseRows, chain.stockPrice, ATM_STRIKE_WINDOW);
  }, [chain, baseRows, showAllStrikes]);

  /** Keep the selected strike visible even when the ATM window omits it. */
  const tableRowsForDisplay = useMemo(() => {
    if (selectedStrike == null) return tableRows;
    if (tableRows.some((r) => r.strike === selectedStrike)) return tableRows;
    const extra = baseRows.find((r) => r.strike === selectedStrike);
    if (!extra) return tableRows;
    return [...tableRows, extra].sort((a, b) => a.strike - b.strike);
  }, [tableRows, baseRows, selectedStrike]);

  const truncated = showAllStrikes && baseRows.length > CHAIN_TABLE_MAX;

  const selectedRow = useMemo(() => {
    if (!chain || selectedStrike == null) return null;
    return chain.optionChain.find((r) => r.strike === selectedStrike) ?? null;
  }, [chain, selectedStrike]);

  const premiumNum = useMemo(() => {
    const p = parseFloat(limitPrice);
    return Number.isFinite(p) && p >= 0 ? p : 0;
  }, [limitPrice]);

  const selectRow = useCallback((strike: number) => {
    setSelectedStrike(strike);
  }, []);

  const rowItm = useCallback(
    (strike: number) => {
      if (!chain) return false;
      const spot = chain.stockPrice;
      if (side === "call") return strike < spot;
      return strike > spot;
    },
    [chain, side]
  );

  const needsOverlay = Boolean(chain) && selectedStrike == null && !loadingChain;

  return (
    <section className="xoptions-contract" aria-label="Choose contract">
      <div className="xoptions-contract__controls">
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
            className="crud-input xoptions-contract__input mt-0.5 w-full min-w-[10rem] font-mono text-sm"
            value={expiration}
            disabled={loadingExp || expirations.length === 0}
            onChange={(e) => setExpiration(e.target.value)}
          >
            {expirations.length === 0 ? (
              <option value="">{loadingExp ? "Loading…" : "—"}</option>
            ) : (
              expirations.map((d) => (
                <option key={d} value={d}>
                  {formatExpirationLabel(d)}
                </option>
              ))
            )}
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
            className="crud-input xoptions-contract__input mt-0.5 w-full min-w-[7rem] font-mono text-sm"
            value={selectedStrike ?? ""}
            disabled={loadingExp || loadingChain || strikeOptions.length === 0}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedStrike(v === "" ? null : Number(v));
            }}
          >
            <option value="">Select</option>
            {strikeOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
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
            className="crud-input xoptions-contract__input mt-0.5 w-full min-w-[6rem] font-mono text-sm"
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
            className="crud-input xoptions-contract__input mt-0.5 w-full min-w-[4rem] font-mono text-sm"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, "") || "1")}
            aria-label="Contracts quantity"
          />
        </div>
      </div>

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

      {error ? (
        <p className="xoptions-alert mb-2" role="alert">
          {error}
        </p>
      ) : null}

      {chain ? (
        <div className="xoptions-contract__grid">
          <div className="xoptions-contract__chain-wrap relative min-w-0">
            {needsOverlay ? (
              <div className="xoptions-contract-overlay pointer-events-none" role="status">
                <ul className="xoptions-contract-overlay__list">
                  <li>Select a strike (table or Strike dropdown)</li>
                  <li>Confirm limit price (filled from mid when you pick)</li>
                </ul>
              </div>
            ) : null}
            <p className="xoptions-mid-three__label mb-1">
              Option chain · {side === "call" ? "Calls" : "Puts"} · spot{" "}
              <span className="font-mono">{chain.stockPrice.toFixed(2)}</span>
            </p>
            <div className="xoptions-contract__table-scroll overflow-x-auto">
              <table className="xoptions-chain-table w-full min-w-[22rem] border-collapse text-left text-[0.6875rem]">
                <thead>
                  <tr className="xoptions-chain-table__head">
                    <th className="py-1 pr-1 font-semibold w-8" />
                    <th className="py-1 pr-2 font-semibold">Strike</th>
                    <th className="py-1 pr-2 font-semibold">Bid</th>
                    <th className="py-1 pr-2 font-semibold">BE</th>
                    <th className="py-1 pr-2 font-semibold">OTM%</th>
                    <th className="py-1 font-semibold">OI</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRowsForDisplay.map((row) => {
                    const leg = side === "call" ? row.call : row.put;
                    const spot = chain.stockPrice;
                    const otm =
                      side === "call" ? otmPercentCall(row.strike, spot) : otmPercentPut(row.strike, spot);
                    const itm = rowItm(row.strike);
                    if (!leg) {
                      return (
                        <tr key={row.strike} className="xoptions-chain-table__row">
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
                    const { abs, pctMid } = spreadMetrics(bid, ask);
                    const q = spreadQuality(abs, pctMid);
                    const spreadClass =
                      q === "ok"
                        ? "xoptions-chain-spread--ok"
                        : q === "mid"
                          ? "xoptions-chain-spread--mid"
                          : "xoptions-chain-spread--wide";
                    return (
                      <tr
                        key={row.strike}
                        className={`xoptions-chain-table__row ${itm ? "xoptions-contract-row--itm" : ""} ${selected ? "xoptions-contract-row--selected" : ""}`}
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
                            onClick={() => selectRow(row.strike)}
                          >
                            ${bid.toFixed(2)}
                          </button>
                        </td>
                        <td className="py-0.5 pr-2 font-mono">${be.toFixed(2)}</td>
                        <td className={`py-0.5 pr-2 font-mono ${spreadClass}`}>{otm.toFixed(1)}</td>
                        <td className="py-0.5 font-mono">{legOi(leg).toLocaleString()}</td>
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
              <a className="xoptions-text-link text-xs" href="/xstrategybuilder/strategy-options">
                How to read the option chain
              </a>
              <span className="xoptions-contract__itm-legend text-xs text-[var(--xf-text-400)]">
                <span className="xoptions-contract__itm-swatch" aria-hidden /> In the money
              </span>
            </p>
          </div>

          <div className="xoptions-contract__payoff min-w-0">
            <p className="xoptions-mid-three__label mb-1">Payoff at expiration</p>
            {selectedRow && premiumNum >= 0 ? (
              <XoptionsContractPayoffChart
                side={side}
                strike={selectedRow.strike}
                premium={premiumNum}
                spot={chain.stockPrice}
              />
            ) : (
              <div className="xoptions-contract-payoff__empty xoptions-contract-payoff__empty--box">
                Select a strike and limit to preview the payoff diagram for the active side (
                {side === "call" ? "calls" : "puts"}).
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="xoptions-hint text-sm">
          {loadingExp || loadingChain
            ? "Loading chain…"
            : u
              ? "Pick an expiration to load quotes."
              : "Enter a symbol in step 1."}
        </p>
      )}

      <p className="xoptions-contract__disclaimer mt-3 text-xs text-[var(--xf-text-400)]">
        * Values use current chain quotes (bid/ask mid for BE). Not financial advice.
      </p>
    </section>
  );
}
