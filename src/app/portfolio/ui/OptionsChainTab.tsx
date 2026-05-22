"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    collectOptionsChainSymbolsFromPositions,
    mergeOptionsChainSymbolList,
    resolveDefaultOptionsChainSymbol
} from "@/app/portfolio/lib/portfolio-options-chain-symbols";
import {
    OptionsChainQuickActionDrawer,
    type OptionsChainQuickActionSelection
} from "@/app/portfolio/ui/options-chain-quick-action-drawer";
import { PortfolioBrokerAccountMark } from "@/app/portfolio/ui/portfolio-broker-account-mark";
import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import { OptionChainTable } from "@/components/xoptions/option-chain-table";
import type { BrokerIconSlug } from "@/lib/broker-ui";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import { getCachedOptionChain, makeOptionChainCacheKey, setCachedOptionChain } from "@/lib/xoptions/xoptions-chain-cache";
import {
    CHAIN_LAYOUT_STORAGE_KEY,
    parseSavedLayout,
    type XoptionsChainSavedLayout
} from "@/lib/xoptions/xoptions-chain-column-layout";
import type { XoptionsChainPayload, XoptionsExpirationsPayload } from "@/lib/xoptions/xoptions-chain-types";
import {
    isValidXoptionsUnderlyingSymbol,
    normalizeXoptionsUnderlyingSymbol
} from "@/lib/xoptions/xoptions-desk-deep-link";
import { resolveXoptionsExpirationForHorizon } from "@/lib/xoptions/xoptions-expiration-default";

const WEEK_CHIPS: ReadonlyArray<{ label: string; days: number }> = [
  { label: "1 wk", days: 7 },
  { label: "2 wk", days: 14 },
  { label: "4 wk", days: 28 }
];

type OptionsChainTabProps = {
  portfolioIdHex: string;
  accountIdHex: string;
  accountLabel: string;
  brokerTypeLabel: string;
  brokerIconSlug: BrokerIconSlug | null;
  extAccountRefMasked: string;
  initialPositions: SerializablePosition[];
  initialSymbol?: string | null;
  /** Account-level symbol picker vs position-scoped chain (holdings row). */
  variant?: "account" | "position";
  positionLabel?: string | null;
  initialSide?: "call" | "put" | null;
  initialStrike?: number | null;
  initialExpiration?: string | null;
  positionBuilderHref?: string | null;
  positionFullChainHref?: string | null;
};

function formatExpirationLabel(yyyyMmDd: string): string {
  try {
    const d = new Date(`${yyyyMmDd.slice(0, 10)}T12:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return yyyyMmDd;
  }
}

export function OptionsChainTab({
  portfolioIdHex,
  accountIdHex,
  accountLabel,
  brokerTypeLabel,
  brokerIconSlug,
  extAccountRefMasked,
  initialPositions,
  initialSymbol = null,
  variant = "account"
}: OptionsChainTabProps) {
  const isPositionScope = variant === "position";
  const holdingsSymbols = useMemo(
    () => (isPositionScope ? [] : collectOptionsChainSymbolsFromPositions(initialPositions)),
    [initialPositions, isPositionScope]
  );
  const [manualSymbols, setManualSymbols] = useState<string[]>([]);
  const symbolOptions = useMemo(
    () => mergeOptionsChainSymbolList(holdingsSymbols, manualSymbols),
    [holdingsSymbols, manualSymbols]
  );

  const [symbol, setSymbol] = useState(() => resolveDefaultOptionsChainSymbol(holdingsSymbols, initialSymbol) ?? "");
  const [manualInput, setManualInput] = useState("");
  const [weeks, setWeeks] = useState<number>(14);
  const [side, setSide] = useState<"call" | "put">("call");
  const [expiration, setExpiration] = useState("");
  const [expirations, setExpirations] = useState<string[]>([]);
  const [chain, setChain] = useState<XoptionsChainPayload | null>(null);
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllStrikes, setShowAllStrikes] = useState(false);
  const [greeksExpanded, setGreeksExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSelection, setDrawerSelection] = useState<OptionsChainQuickActionSelection | null>(null);
  const [chainLayoutSaved, setChainLayoutSaved] = useState<XoptionsChainSavedLayout>({
    kind: "preset",
    preset: "default"
  });
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const sideRef = useRef(side);
  sideRef.current = side;
  const spotAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    if (chain?.stockPrice != null && Number.isFinite(chain.stockPrice) && chain.stockPrice > 0) {
      spotAnchorRef.current = chain.stockPrice;
    }
  }, [chain?.stockPrice]);

  useEffect(() => {
    const parsed = parseSavedLayout(
      typeof window !== "undefined" ? window.localStorage.getItem(CHAIN_LAYOUT_STORAGE_KEY) : null
    );
    if (parsed) {
      setChainLayoutSaved(parsed);
    }
  }, []);

  useEffect(() => {
    if (symbol && symbolOptions.includes(symbol)) {
      return;
    }
    const next = resolveDefaultOptionsChainSymbol(symbolOptions, initialSymbol);
    if (next) {
      setSymbol(next);
    }
  }, [symbol, symbolOptions, initialSymbol]);

  const u = symbol.trim().toUpperCase();

  useEffect(() => {
    if (!u || !isValidXoptionsUnderlyingSymbol(u)) {
      setExpirations([]);
      setExpiration("");
      setChain(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingExp(true);
      setError(null);
      try {
        const res = await fetch(`/api/strategy-options/expirations?underlying=${encodeURIComponent(u)}`, {
          credentials: "include"
        });
        const json = (await res.json()) as XoptionsExpirationsPayload;
        if (!res.ok) {
          throw new Error(json.error ?? "Could not load expirations.");
        }
        const dates = json.expirationDates ?? [];
        if (cancelled) {
          return;
        }
        setExpirations(dates);
        const resolved = resolveXoptionsExpirationForHorizon(dates, weeks);
        setExpiration((prev) => (prev && dates.includes(prev) ? prev : resolved ?? ""));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Expirations failed.");
        }
      } finally {
        if (!cancelled) {
          setLoadingExp(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [u, weeks]);

  const loadChain = useCallback(async () => {
    if (!u || !expiration) {
      return;
    }
    const cacheKey = makeOptionChainCacheKey(u, expiration);
    const cached = getCachedOptionChain(cacheKey);
    if (cached) {
      setChain(cached as XoptionsChainPayload);
      setLoadedAt(new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
      setError(null);
      return;
    }

    setLoadingChain(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        underlying: u,
        expiration,
        strike:
          spotAnchorRef.current != null && spotAnchorRef.current > 0
            ? String(spotAnchorRef.current)
            : "0"
      });
      const res = await fetch(`/api/strategy-options?${qs.toString()}`, { credentials: "include" });
      const payload = (await res.json()) as XoptionsChainPayload & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Could not load option chain.");
      }
      setCachedOptionChain(cacheKey, payload);
      setChain(payload);
      setLoadedAt(new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chain load failed.");
      setChain(null);
    } finally {
      setLoadingChain(false);
    }
  }, [u, expiration]);

  useEffect(() => {
    if (!u || !expiration) {
      setChain(null);
      setSelectedStrike(null);
      return;
    }
    void loadChain();
  }, [u, expiration, loadChain]);

  const addManualSymbol = useCallback(() => {
    const next = normalizeXoptionsUnderlyingSymbol(manualInput);
    if (!isValidXoptionsUnderlyingSymbol(next)) {
      setError("Enter a valid ticker (1–10 characters, A–Z, 0–9, . or -).");
      return;
    }
    setError(null);
    setManualSymbols((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setSymbol(next);
    setManualInput("");
  }, [manualInput]);

  const openDrawerForStrike = useCallback(
    (strike: number) => {
      if (!chain || !expiration) {
        return;
      }
      const row = chain.optionChain.find((r) => r.strike === strike);
      const leg = row ? (sideRef.current === "call" ? row.call : row.put) : null;
      if (!leg?.last_quote) {
        return;
      }
      const bid = leg.last_quote.bid;
      const ask = leg.last_quote.ask;
      setSelectedStrike(strike);
      setDrawerSelection({
        symbol: u,
        side: sideRef.current,
        strike,
        expiration,
        spot: chain.stockPrice,
        bid,
        ask,
        mid: (bid + ask) / 2
      });
      setDrawerOpen(true);
    },
    [chain, expiration, u]
  );

  const applyWeekHorizon = useCallback((days: number) => {
    setWeeks(days);
    const next = resolveXoptionsExpirationForHorizon(expirations, days);
    if (next) {
      setExpiration(next);
    }
  }, [expirations]);

  const busy = loadingExp || loadingChain;

  return (
    <section className="portfolio-options-chain-tab xf-noise-overlay" aria-labelledby="portfolio-options-chain-title">
      <h2 id="portfolio-options-chain-title" className="sr-only">
        Options chain
      </h2>

      <div className="portfolio-options-chain-tab__account-context">
        <PortfolioBrokerAccountMark
          accountName={accountLabel}
          brokerIconSlug={brokerIconSlug}
          brokerTypeLabel={brokerTypeLabel}
          extAccountRefMasked={extAccountRefMasked}
        />
      </div>

      <div className="portfolio-options-chain-tab__toolbar">
        <div className="portfolio-options-chain-tab__symbol-block">
          <p className="portfolio-options-chain-tab__label">Symbol</p>
          <div className="portfolio-options-chain-tab__chips">
            {symbolOptions.length === 0 ? (
              <p className="portfolio-options-chain-tab__hint">Add holdings or enter a ticker below.</p>
            ) : (
              symbolOptions.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  className={`portfolio-options-chain-tab__chip${sym === u ? " portfolio-options-chain-tab__chip--active" : ""}`}
                  onClick={() => setSymbol(sym)}
                  aria-pressed={sym === u}
                >
                  <PortfolioSymbolMark symbol={sym} size={20} />
                  <span className="font-mono">{sym}</span>
                </button>
              ))
            )}
          </div>
          <div className="portfolio-options-chain-tab__manual">
            <input
              className="crud-input portfolio-options-chain-tab__manual-input font-mono text-xs"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value.toUpperCase())}
              placeholder="Add symbol (e.g. TSLA)"
              maxLength={10}
              aria-label="Add symbol manually"
            />
            <button type="button" className="cta cta-secondary portfolio-options-chain-tab__manual-add" onClick={addManualSymbol}>
              Add
            </button>
          </div>
        </div>

        <div className="portfolio-options-chain-tab__controls">
          <div className="portfolio-options-chain-tab__control">
            <span className="portfolio-options-chain-tab__label">Horizon</span>
            <div className="portfolio-options-chain-tab__weeks">
              {WEEK_CHIPS.map(({ label, days }) => (
                <button
                  key={days}
                  type="button"
                  className={`portfolio-options-chain-tab__week${weeks === days ? " portfolio-options-chain-tab__week--active" : ""}`}
                  onClick={() => applyWeekHorizon(days)}
                  aria-pressed={weeks === days}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="portfolio-options-chain-tab__control">
            <label className="portfolio-options-chain-tab__label" htmlFor="portfolio-options-chain-exp">
              Expiration
            </label>
            <select
              id="portfolio-options-chain-exp"
              className="crud-input portfolio-options-chain-tab__select"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              disabled={!u || expirations.length === 0 || loadingExp}
            >
              <option value="">Select expiration</option>
              {expirations.map((d) => (
                <option key={d} value={d}>
                  {formatExpirationLabel(d)}
                </option>
              ))}
            </select>
          </div>

          <div className="portfolio-options-chain-tab__control">
            <span className="portfolio-options-chain-tab__label">Side</span>
            <div className="portfolio-options-chain-tab__side-toggle" role="group" aria-label="Option side">
              {(["call", "put"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`portfolio-options-chain-tab__side${side === s ? " portfolio-options-chain-tab__side--active" : ""}`}
                  onClick={() => setSide(s)}
                  aria-pressed={side === s}
                >
                  {s === "call" ? "Calls" : "Puts"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="cta cta-secondary portfolio-options-chain-tab__refresh"
            onClick={() => void loadChain()}
            disabled={!u || !expiration || busy}
          >
            <RefreshIcon className="crud-icon" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="status-text status-error" role="alert">
          {error}
        </p>
      ) : null}

      {busy && !chain ? (
        <p className="portfolio-options-chain-tab__loading" role="status" aria-live="polite">
          Loading option chain for {u || "symbol"}…
        </p>
      ) : null}

      {chain ? (
        <>
          <div className="portfolio-options-chain-tab__chain-head">
            <p className="portfolio-options-chain-tab__chain-meta">
              {u} · spot <span className="font-mono">{chain.stockPrice.toFixed(2)}</span>
              {expiration ? (
                <>
                  {" "}
                  · exp <span className="font-mono">{formatExpirationLabel(expiration)}</span>
                </>
              ) : null}
              {loadedAt ? (
                <>
                  {" "}
                  · updated <span className="font-mono">{loadedAt}</span>
                </>
              ) : null}
            </p>
            <div className="portfolio-options-chain-tab__chain-actions">
              <button
                type="button"
                className="portfolio-options-chain-tab__inline-toggle"
                onClick={() => setGreeksExpanded((v) => !v)}
                aria-expanded={greeksExpanded}
              >
                {greeksExpanded ? "Hide Greeks" : "Show Greeks"}
              </button>
              <button
                type="button"
                className="portfolio-options-chain-tab__inline-toggle"
                onClick={() => setShowAllStrikes((v) => !v)}
                aria-pressed={showAllStrikes}
              >
                {showAllStrikes ? "ATM band" : "All strikes"}
              </button>
            </div>
          </div>

          <div className="portfolio-options-chain-tab__table-scroll">
            <OptionChainTable
              chain={chain}
              side={side}
              selectedStrike={selectedStrike}
              onSelectStrike={openDrawerForStrike}
              chainLayoutSaved={chainLayoutSaved}
              greeksExpanded={greeksExpanded}
              showAllStrikes={showAllStrikes}
              mode="portfolio"
            />
          </div>

          <p className="portfolio-options-chain-tab__disclaimer">{EDUCATIONAL_ONLY_SHORT}</p>
        </>
      ) : null}

      <OptionsChainQuickActionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        portfolioIdHex={portfolioIdHex}
        accountIdHex={accountIdHex}
        accountLabel={accountLabel}
        selection={drawerSelection}
      />
    </section>
  );
}
