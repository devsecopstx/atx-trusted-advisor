"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore
} from "react";

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
    CHAIN_COLUMN_LABELS,
    CHAIN_LAYOUT_STORAGE_KEY,
    deriveStateFromSaved,
    isChainGreekColumnId,
    isFirstVisibleColumnInChainGroup,
    normalizeColumnOrder,
    parseSavedLayout,
    savedMatchesPreset,
    serializeSavedLayout,
    visibleOrderedColumnsFromSaved,
    XOPTIONS_CHAIN_DATA_COLUMN_IDS,
    type XoptionsChainDataColumnId,
    type XoptionsChainLayoutPresetId,
    type XoptionsChainSavedLayout
} from "@/lib/xoptions/xoptions-chain-column-layout";
import {
    chainHeatMixPercent,
    chainRowMoneynessClass,
    closestStrikeToSpot,
    filterOptionChainRowsByLiquidity,
    filterStrikesBySpotBand,
    formatImpliedVolatilityDisplay,
    legHasQuotableLastQuote,
    maxVolumeAndOpenInterestForSide,
    sliceStrikesAroundSpot,
    STRIKE_SPOT_BAND_PCT
} from "@/lib/xoptions/xoptions-chain-helpers";
import {
    getPayoffPreviewSyncSnapshot,
    isShowGreeksCalcLogicEnabled,
    isTaxEducationEnabled,
    subscribeXoptionsEducationPrefs
} from "@/lib/xoptions/xoptions-education-preferences";
import {
    partitionExpirationsForStrikeDatePicker,
    resolveXoptionsExpirationForHorizon
} from "@/lib/xoptions/xoptions-expiration-default";
import {
    buildXoptionsOrderReview,
    formatXoptionsOrderReviewPlainText,
    type XoptionsOpeningAction
} from "@/lib/xoptions/xoptions-order-preview";

type ChainLeg = {
  last_quote: { bid: number; ask: number };
  /** Last trade price per share when provided by chain payload; otherwise UI falls back to mid. */
  premium?: number;
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

function XoptionsChainFetchProgress({
  mode,
  symbol,
  expirationDisplay
}: {
  mode: "expirations" | "chain";
  symbol: string;
  expirationDisplay?: string;
}) {
  const sym = symbol.trim().toUpperCase();
  const label =
    mode === "expirations"
      ? `Loading expiration dates for ${sym}…`
      : `Fetching option chain quotes for ${sym}${expirationDisplay ? ` · ${expirationDisplay}` : ""}…`;
  return (
    <div className="xoptions-chain-fetch-status mb-3" role="status" aria-live="polite" aria-busy="true">
      <p className="xoptions-chain-fetch-status__label m-0 mb-2">{label}</p>
      <div
        className="xoptions-chain-fetch-status__track"
        role="progressbar"
        aria-valuetext={label}
      >
        <div className="xoptions-chain-fetch-status__indeterminate" aria-hidden />
      </div>
    </div>
  );
}

function breakevenLong(side: "call" | "put", strike: number, premiumPerShare: number): number {
  if (side === "call") return strike + premiumPerShare;
  return Math.max(0, strike - premiumPerShare);
}

/**
 * Auto limit per share: buying pays the offer (ask); selling collects the bid.
 * Falls back to mid / single-sided quote when NBBO is incomplete.
 */
function defaultLimitPricePerShareForOpening(
  openingAction: XoptionsOpeningAction,
  leg: ChainLeg
): number | null {
  if (!leg?.last_quote) {
    return null;
  }
  const { bid, ask } = leg.last_quote;
  const bidOk = typeof bid === "number" && Number.isFinite(bid) && bid >= 0;
  const askOk = typeof ask === "number" && Number.isFinite(ask) && ask >= 0;
  const mid =
    bidOk && askOk ? (bid + ask) / 2 : bidOk ? bid : askOk ? ask : null;
  if (openingAction === "buy_to_open") {
    if (askOk && ask > 0) {
      return ask;
    }
    if (mid != null && mid > 0) {
      return mid;
    }
    if (bidOk && bid > 0) {
      return bid;
    }
    return null;
  }
  if (bidOk && bid > 0) {
    return bid;
  }
  if (mid != null && mid > 0) {
    return mid;
  }
  if (askOk && ask > 0) {
    return ask;
  }
  return null;
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
  /** Optional deep-link contract prefill from scan/report actions. */
  initialContractPrefill?: { expiration: string; strike: number; contractType: "call" | "put" } | null;
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

function deltaGreekClass(delta: number | undefined): string {
  if (delta == null || !Number.isFinite(delta)) {
    return "xoptions-chain-table__greek-neutral";
  }
  return delta < 0 ? "xoptions-chain-table__greek-delta-neg" : "xoptions-chain-table__greek-delta-pos";
}

function ChainSortHint() {
  return (
    <span className="xoptions-chain-table__sort-hint" aria-hidden="true">
      <span className="xoptions-chain-table__sort-hint-up">↑</span>
      <span className="xoptions-chain-table__sort-hint-down">↓</span>
    </span>
  );
}

const CHAIN_LAYOUT_PRESETS: { id: XoptionsChainLayoutPresetId; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "greeks", label: "Greeks" },
  { id: "liquidity", label: "Liquidity" },
  { id: "advanced", label: "Advanced" }
];

function ChainColumnLayoutToolbar({
  savedLayout,
  onSavedLayoutChange
}: {
  savedLayout: XoptionsChainSavedLayout;
  onSavedLayoutChange: (next: XoptionsChainSavedLayout) => void;
}) {
  const { order, hidden } = useMemo(() => deriveStateFromSaved(savedLayout), [savedLayout]);

  const toggleColumn = (id: XoptionsChainDataColumnId, visible: boolean) => {
    if (id === "strike" && !visible) {
      return;
    }
    const nextHidden = new Set(hidden);
    if (visible) {
      nextHidden.delete(id);
    } else {
      nextHidden.add(id);
    }
    const shown = XOPTIONS_CHAIN_DATA_COLUMN_IDS.filter((c) => !nextHidden.has(c));
    if (shown.length === 0) {
      return;
    }
    onSavedLayoutChange({
      kind: "custom",
      order: normalizeColumnOrder(order),
      hidden: XOPTIONS_CHAIN_DATA_COLUMN_IDS.filter((c) => nextHidden.has(c))
    });
  };

  const reorder = (fromId: XoptionsChainDataColumnId, toId: XoptionsChainDataColumnId) => {
    if (fromId === toId) {
      return;
    }
    const o = [...order];
    const fi = o.indexOf(fromId);
    const ti = o.indexOf(toId);
    if (fi < 0 || ti < 0) {
      return;
    }
    const [item] = o.splice(fi, 1);
    o.splice(ti, 0, item);
    onSavedLayoutChange({
      kind: "custom",
      order: normalizeColumnOrder(o),
      hidden: XOPTIONS_CHAIN_DATA_COLUMN_IDS.filter((c) => hidden.has(c))
    });
  };

  return (
    <details className="xoptions-chain-layout-toolbar group mb-2 rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] px-2 py-1.5">
      <summary className="cursor-pointer select-none text-[0.65rem] font-semibold tracking-wide text-[var(--xf-text-300)] outline-none marker:text-[var(--xf-text-400)] [&::-webkit-details-marker]:hidden">
        Columns & layouts
      </summary>
      <div className="mt-2 space-y-2 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Layout presets">
          {CHAIN_LAYOUT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`rounded-md border px-2 py-1 text-[0.62rem] font-semibold transition-colors ${
                savedMatchesPreset(savedLayout, p.id)
                  ? "border-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_12%,transparent)] text-[var(--xf-text-100)]"
                  : "border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-transparent text-[var(--xf-text-300)] hover:border-[color-mix(in_srgb,var(--xf-text-100)_22%,transparent)] hover:text-[var(--xf-text-200)]"
              }`}
              onClick={() => onSavedLayoutChange({ kind: "preset", preset: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="m-0 text-[0.58rem] leading-snug text-[var(--xf-text-500)]">
          Drag rows to reorder. Presets and custom layouts are saved in this browser (
          <span className="font-mono">{CHAIN_LAYOUT_STORAGE_KEY}</span>).
        </p>
        <ul className="m-0 max-h-48 list-none space-y-1 overflow-y-auto p-0">
          {order.map((cid) => {
            const meta = CHAIN_COLUMN_LABELS[cid];
            const checked = !hidden.has(cid);
            return (
              <li
                key={cid}
                className="flex items-center gap-2 rounded border border-transparent px-1 py-0.5 hover:border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)]"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-xo-chain-col", cid);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData("application/x-xo-chain-col") as XoptionsChainDataColumnId;
                  if (from && XOPTIONS_CHAIN_DATA_COLUMN_IDS.includes(from)) {
                    reorder(from, cid);
                  }
                }}
              >
                <span className="cursor-grab text-[0.55rem] text-[var(--xf-text-500)]" aria-hidden>
                  ⋮⋮
                </span>
                <input
                  type="checkbox"
                  className="accent-[var(--xf-gain-green)]"
                  checked={checked}
                  disabled={cid === "strike"}
                  onChange={(ev) => toggleColumn(cid, ev.target.checked)}
                  aria-label={`Show ${meta.abbr} column`}
                />
                <span className="min-w-0 flex-1 text-[0.62rem] font-medium text-[var(--xf-text-200)]">
                  {meta.abbr}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
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
  strategyStartBasis = null,
  initialContractPrefill = null
}: XoptionsChooseContractProps) {
  const u = symbol.trim().toUpperCase();

  const [expirations, setExpirations] = useState<string[]>([]);
  /** When `strike_dates`, expiration `<select>` lists weekly (4 wk) + monthly (3rd Fri, ~18 mo) only. */
  const [expirationListMode, setExpirationListMode] = useState<"all" | "strike_dates">("all");
  const [expiration, setExpiration] = useState("");
  const [chain, setChain] = useState<ChainPayload | null>(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [side, setSide] = useState<"call" | "put">("call");
  const [showAllStrikes, setShowAllStrikes] = useState(false);
  /** Mobile-only: show Δ/Γ/Θ/Vega columns (desktop always shows). */
  const [mobileGreeksOpen, setMobileGreeksOpen] = useState(false);
  const [chainLayoutSaved, setChainLayoutSaved] = useState<XoptionsChainSavedLayout>({
    kind: "preset",
    preset: "default"
  });
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [limitPrice, setLimitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [prefillApplied, setPrefillApplied] = useState(false);
  const strategyDefaultsResolved = useMemo(
    () => strategyDefaults(strategyChoiceId),
    [strategyChoiceId]
  );
  const openingActionResolved: XoptionsOpeningAction =
    strategyDefaultsResolved?.openingAction ?? "buy_to_open";

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
    getPayoffPreviewSyncSnapshot,
    () => false
  );

  useEffect(() => {
    setExpiration("");
    setExpirationListMode("all");
    setSelectedStrike(null);
    setLimitPrice("");
    setQuantity("");
    setChain(null);
    setShowAllStrikes(false);
    setError(null);
    setPrefillApplied(false);
  }, [u]);

  useEffect(() => {
    const parsed = parseSavedLayout(
      typeof window !== "undefined" ? window.localStorage.getItem(CHAIN_LAYOUT_STORAGE_KEY) : null
    );
    if (parsed) {
      setChainLayoutSaved(parsed);
    }
  }, []);

  const persistChainLayout = useCallback((next: XoptionsChainSavedLayout) => {
    setChainLayoutSaved(next);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(CHAIN_LAYOUT_STORAGE_KEY, serializeSavedLayout(next));
    } catch {
      /* quota / private mode */
    }
  }, []);

  const strikeDateBuckets = useMemo(
    () => partitionExpirationsForStrikeDatePicker(expirations),
    [expirations]
  );

  useEffect(() => {
    if (expirationListMode !== "strike_dates") {
      return;
    }
    const allowed = new Set([...strikeDateBuckets.weekly, ...strikeDateBuckets.monthly]);
    const cur = expiration.slice(0, 10);
    if (cur && !allowed.has(cur)) {
      setExpiration("");
    }
  }, [expirationListMode, expiration, strikeDateBuckets]);

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
    if (!initialContractPrefill || prefillApplied) {
      return;
    }
    setSide(initialContractPrefill.contractType);
  }, [initialContractPrefill, prefillApplied]);

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
    if (!initialContractPrefill || prefillApplied) {
      return;
    }
    if (expirations.includes(initialContractPrefill.expiration)) {
      setExpiration(initialContractPrefill.expiration);
    }
  }, [expirations, initialContractPrefill, prefillApplied]);

  useEffect(() => {
    if (!u || !expiration) {
      setChain(null);
      setSelectedStrike(null);
      return;
    }
    let cancelled = false;

    const applyPayload = (payload: ChainPayload) => {
      setChain(payload);
      const rows = filterOptionChainRowsByLiquidity(payload.optionChain).rows;
      const spot = payload.stockPrice;
      const s = sideRef.current;
      const strikeList = rows
        .filter((r) => {
          const leg = s === "call" ? r.call : r.put;
          return leg != null && legHasQuotableLastQuote(leg);
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

  useEffect(() => {
    if (!initialContractPrefill || prefillApplied || !chain) {
      return;
    }
    if (chain.expiration !== initialContractPrefill.expiration) {
      return;
    }
    const nearestStrike = chain.optionChain.reduce<number | null>((closest, row) => {
      if (closest == null) {
        return row.strike;
      }
      const currentDistance = Math.abs(row.strike - initialContractPrefill.strike);
      const bestDistance = Math.abs(closest - initialContractPrefill.strike);
      return currentDistance < bestDistance ? row.strike : closest;
    }, null);
    if (nearestStrike != null) {
      setSelectedStrike(nearestStrike);
      setQuantity((prev) => (prev.trim() ? prev : "1"));
    }
    setPrefillApplied(true);
  }, [chain, initialContractPrefill, prefillApplied]);

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
    () => (chain ? filterOptionChainRowsByLiquidity(chain.optionChain).rows : []),
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

  const heatMaxes = useMemo(() => {
    if (!chain) {
      return { maxVol: 0, maxOi: 0 };
    }
    return maxVolumeAndOpenInterestForSide(tableRowsForDisplay, side);
  }, [chain, tableRowsForDisplay, side]);

  const visibleChainDataCols = useMemo(
    () => visibleOrderedColumnsFromSaved(chainLayoutSaved),
    [chainLayoutSaved]
  );

  const chainTableColSpan = visibleChainDataCols.length + 2;

  const chainChooserThClass = (cid: XoptionsChainDataColumnId) =>
    [
      "xoptions-chain-table__th-pad",
      isChainGreekColumnId(cid) ? "xoptions-chain-table__col-greek" : "",
      cid === "strike" ? "" : "text-right",
      isFirstVisibleColumnInChainGroup(cid, visibleChainDataCols) ? "xoptions-chain-table__col-group-start" : ""
    ]
      .filter(Boolean)
      .join(" ");

  const renderGreekTd = useCallback(
    (
      cid: XoptionsChainDataColumnId,
      kind: "delta" | "gamma" | "theta" | "vega",
      raw: number | undefined,
      digits: number
    ) => {
      const cls =
        kind === "delta"
          ? deltaGreekClass(raw)
          : kind === "theta"
            ? "xoptions-chain-table__greek-theta"
            : "xoptions-chain-table__greek-sky";
      return (
        <td
          key={cid}
          className={`xoptions-chain-table__td-pad xoptions-chain-table__col-greek font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${
            isFirstVisibleColumnInChainGroup(cid, visibleChainDataCols) ? "xoptions-chain-table__col-group-start" : ""
          } ${cls}`}
        >
          {formatGreek(raw, digits)}
        </td>
      );
    },
    [visibleChainDataCols]
  );

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
  const roughBudgetUsd = strategyStartBasis?.mode === "cash" ? strategyStartBasis.usd : null;
  const maxEstimatedContractsFromCash = useMemo(() => {
    if (roughBudgetUsd == null || !Number.isFinite(roughBudgetUsd) || roughBudgetUsd <= 0) {
      return null;
    }
    if (!limitOk || limitNum <= 0) {
      return null;
    }
    return Math.max(0, Math.floor(roughBudgetUsd / (limitNum * 100)));
  }, [roughBudgetUsd, limitNum, limitOk]);

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
      openingAction: openingActionResolved,
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
    openingActionResolved,
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

  const syncLimitPriceFromNaturalQuote = useCallback(
    (strike: number) => {
      if (!chain) {
        return;
      }
      const row = chain.optionChain.find((r) => r.strike === strike);
      const leg = row ? (side === "call" ? row.call : row.put) : null;
      if (!leg) {
        return;
      }
      const px = defaultLimitPricePerShareForOpening(openingActionResolved, leg);
      if (px != null) {
        setLimitPrice(px.toFixed(2));
      }
    },
    [chain, side, openingActionResolved]
  );

  useEffect(() => {
    if (!chain || selectedStrike == null) return;
    syncLimitPriceFromNaturalQuote(selectedStrike);
  }, [chain, side, selectedStrike, syncLimitPriceFromNaturalQuote]);

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
        Pick a horizon chip, use <strong>Choose strike dates</strong> for weekly/monthly expirations, or pick any
        expiration (chain loads after this)
      </li>
      <li className={selectedStrike != null ? "xoptions-contract-overlay__li--done" : ""}>
        Select a strike price
      </li>
      <li className={limitOk ? "xoptions-contract-overlay__li--done" : ""}>
        Select or enter a limit price (auto: {openingActionResolved === "buy_to_open" ? "ask to buy" : "bid to sell"}
        ; tap Bid or Ask or type)
      </li>
      <li className={qtyOk ? "xoptions-contract-overlay__li--done" : ""}>Enter quantity</li>
    </ul>
  );

  return (
    <section className="xoptions-contract min-w-0" aria-label="Choose contract">
      <div className="xoptions-contract__horizon mb-4 pb-4 md:mb-3 md:pb-3">
        <p className="xoptions-top-option-header__label">Target expiration</p>
        <div className="mt-2 flex flex-wrap gap-3 md:mt-1 md:gap-2">
          {WEEK_CHIPS.map((w) => (
            <button
              key={w.days}
              type="button"
              aria-label={`Target expiration horizon ${w.label}, about ${w.days} calendar days from today`}
              aria-pressed={weeks !== null && weeks === w.days}
              className={`xoptions-choice ${weeks !== null && weeks === w.days ? "xoptions-choice--active" : ""}`}
              disabled={loadingExp || expirations.length === 0}
              onClick={() => applyWeekHorizon(w.days)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <p className="xoptions-hint mt-2 text-xs md:mt-1">
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
            <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
              <label className="xoptions-contract__label m-0" htmlFor="xo-contract-exp">
                Expiration
              </label>
              {expirations.length > 0 && !loadingExp ? (
                <button
                  type="button"
                  className="m-0 min-h-11 shrink-0 rounded-md border border-transparent px-2 py-2 text-left text-xs font-medium text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] underline-offset-2 hover:border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] hover:underline md:min-h-0 md:border-0 md:bg-transparent md:p-0"
                  onClick={() => setExpirationListMode((m) => (m === "all" ? "strike_dates" : "all"))}
                >
                  {expirationListMode === "all" ? "Choose strike dates" : "Show all expirations"}
                </button>
              ) : null}
            </div>
            <select
              id="xo-contract-exp"
              className="crud-input xoptions-contract__input mt-1 w-full min-w-0 touch-manipulation font-mono text-sm md:mt-0.5"
              value={expiration}
              disabled={
                loadingExp ||
                expirations.length === 0 ||
                (expirationListMode === "strike_dates" &&
                  strikeDateBuckets.weekly.length === 0 &&
                  strikeDateBuckets.monthly.length === 0)
              }
              onChange={(e) => onExpirationSelectChange(e.target.value)}
            >
              <option value="">
                {loadingExp
                  ? "Loading…"
                  : expirationListMode === "strike_dates"
                    ? strikeDateBuckets.weekly.length === 0 && strikeDateBuckets.monthly.length === 0
                      ? "No weekly/monthly expirations in range"
                      : "Choose expiration to load chain"
                    : "Choose expiration to load chain"}
              </option>
              {expirationListMode === "all"
                ? expirations.map((d) => (
                    <option key={d} value={d}>
                      {formatExpirationLabel(d)}
                    </option>
                  ))
                : (
                    <>
                      {strikeDateBuckets.weekly.length > 0 ? (
                        <optgroup label="Weekly (next 4 weeks)">
                          {strikeDateBuckets.weekly.map((d) => (
                            <option key={d} value={d}>
                              {formatExpirationLabel(d)}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {strikeDateBuckets.monthly.length > 0 ? (
                        <optgroup label="Monthly (through 18 months)">
                          {strikeDateBuckets.monthly.map((d) => (
                            <option key={d} value={d}>
                              {formatExpirationLabel(d)}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </>
                  )}
            </select>
            {expirationListMode === "strike_dates" ? (
              <p className="xoptions-hint mt-1 text-xs text-[var(--xf-text-400)]">
                Weekly = expirations within the next 4 weeks. Monthly = standard 3rd-Friday expirations up to ~18 months
                out. Use <strong>Show all expirations</strong> for the full chain calendar.
              </p>
            ) : null}
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
              className="crud-input xoptions-contract__input mt-1 w-full min-w-0 touch-manipulation font-mono text-sm md:mt-0.5"
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
              className="crud-input xoptions-contract__input mt-1 w-full min-w-0 touch-manipulation font-mono text-sm md:mt-0.5"
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
              className="crud-input xoptions-contract__input mt-1 w-full min-w-0 touch-manipulation font-mono text-sm md:mt-0.5"
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
                .{" "}
                {maxEstimatedContractsFromCash == null
                  ? "Enter a limit to estimate max contracts from cash."
                  : `Max est contracts from cash: ${maxEstimatedContractsFromCash}.`}{" "}
                Adjust contracts to match risk.
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

      {u && loadingChain && expiration ? (
        <XoptionsChainFetchProgress
          expirationDisplay={formatExpirationLabel(expiration)}
          mode="chain"
          symbol={u}
        />
      ) : u && loadingExp ? (
        <XoptionsChainFetchProgress mode="expirations" symbol={u} />
      ) : null}

      {u ? (
        <div
          className={`xoptions-contract__split${!payoffPreviewEnabled ? " xoptions-contract__split--no-aside" : ""}`}
        >
          <div className="xoptions-contract__split-main">
            <div
              className={`xoptions-contract__grid${!payoffPreviewEnabled ? " xoptions-contract__grid--no-payoff" : ""}`}
            >
          <div id="xoptions-chain-panel" className="xoptions-contract__chain-wrap relative min-w-0">
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
                    <div className="mb-1 flex justify-end lg:hidden">
                      <button
                        type="button"
                        className="rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] px-2 py-1 text-[0.65rem] font-medium text-[var(--xf-text-300)] hover:border-[color-mix(in_srgb,var(--xf-text-100)_22%,transparent)] hover:text-[var(--xf-text-200)]"
                        onClick={() => setMobileGreeksOpen((v) => !v)}
                        aria-expanded={mobileGreeksOpen}
                      >
                        {mobileGreeksOpen ? "Hide Greeks" : "Show Greeks"}
                      </button>
                    </div>
                    <div ref={chainTableScrollRef} className="xoptions-contract__table-scroll min-w-0">
                    <ChainColumnLayoutToolbar
                      savedLayout={chainLayoutSaved}
                      onSavedLayoutChange={persistChainLayout}
                    />
                    <div className="xoptions-chain-table__viewport">
                    <table
                      className={`xoptions-chain-table xoptions-chain-table--compact xoptions-chain-table--contract-chooser xoptions-chain-table--hnwi w-full border-collapse text-left ${mobileGreeksOpen ? "xoptions-chain-table--greeks-mobile-open" : ""}`}
                      style={{
                        minWidth: `${Math.max(44, 10 + visibleChainDataCols.length * 3.35)}rem`
                      }}
                    >
                      <thead>
                        <tr className="xoptions-chain-table__head">
                          <th className="xoptions-chain-table__th-pad w-8" scope="col" />
                          {visibleChainDataCols.map((cid) => {
                            const meta = CHAIN_COLUMN_LABELS[cid];
                            const labelClass =
                              cid === "strike"
                                ? "xoptions-chain-table__th-label"
                                : "xoptions-chain-table__th-label xoptions-chain-table__th-label--end";
                            return (
                              <th
                                key={cid}
                                className={chainChooserThClass(cid)}
                                scope="col"
                                title={meta.title}
                              >
                                <span className={labelClass}>
                                  {meta.abbr} <ChainSortHint />
                                </span>
                              </th>
                            );
                          })}
                          <th className="xoptions-chain-table__th-pad w-[4.5rem] text-right" scope="col" aria-label="Row action" />
                        </tr>
                      </thead>
                      <tbody>
                        {tableRowsForDisplay.map((row) => {
                          const leg = side === "call" ? row.call : row.put;
                          const spot = chain.stockPrice;
                          const moneynessClass = chainRowMoneynessClass(row.strike, spot, side, atmStrike);
                          if (!leg || !legHasQuotableLastQuote(leg)) {
                            return (
                              <tr
                                key={row.strike}
                                className="xoptions-chain-table__row"
                                data-xo-strike={row.strike}
                              >
                                <td
                                  colSpan={chainTableColSpan}
                                  className="xoptions-chain-table__td-pad xoptions-chain-table__empty"
                                >
                                  {row.strike} — no quote
                                </td>
                              </tr>
                            );
                          }
                          const bid = leg.last_quote.bid;
                          const ask = leg.last_quote.ask;
                          const mid = (bid + ask) / 2;
                          const lastPx =
                            leg.premium != null && Number.isFinite(leg.premium) ? leg.premium : mid;
                          const spreadAbs = ask - bid;
                          const be = breakevenLong(side, row.strike, mid);
                          const selected = selectedStrike === row.strike;
                          const ivDisplay = formatImpliedVolatilityDisplay(leg.implied_volatility);
                          const vol =
                            typeof leg.volume === "number" && Number.isFinite(leg.volume)
                              ? leg.volume
                              : 0;
                          const oiVal = legOi(leg);
                          const g = leg.greeks;
                          const oiMix = chainHeatMixPercent(oiVal, heatMaxes.maxOi);
                          const isAtm = atmStrike != null && Math.abs(row.strike - atmStrike) < 1e-6;
                          const oiCellStyle =
                            oiMix > 0
                              ? { background: `color-mix(in srgb, var(--xf-gain-green) ${oiMix}%, transparent)` }
                              : undefined;
                          const gb = (cid: XoptionsChainDataColumnId) =>
                            isFirstVisibleColumnInChainGroup(cid, visibleChainDataCols)
                              ? "xoptions-chain-table__col-group-start"
                              : "";
                          return (
                            <tr
                              key={row.strike}
                              data-xo-strike={row.strike}
                              className={`xoptions-chain-table__row xoptions-chain-table__row--interactive ${moneynessClass} ${selected ? "xoptions-contract-row--selected" : ""}`}
                              onClick={() => selectRow(row.strike)}
                            >
                              <td className="xoptions-chain-table__td-pad align-middle">
                                <input
                                  type="radio"
                                  name="xo-contract-strike-row"
                                  className="xoptions-contract__radio"
                                  checked={selected}
                                  onChange={() => selectRow(row.strike)}
                                  aria-label={`Strike ${row.strike}`}
                                />
                              </td>
                              {visibleChainDataCols.map((cid) => {
                                if (cid === "strike") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-chain-table__strike-cell align-middle ${gb("strike")}`}
                                    >
                                      <span className="xoptions-chain-table__strike-val xoptions-chain-table__strike-val--brand font-mono tabular-nums tracking-tight">
                                        {row.strike}
                                      </span>
                                      {isAtm ? (
                                        <span className="xoptions-chain-table__atm-badge xoptions-chain-table__atm-badge--brand">
                                          ATM
                                        </span>
                                      ) : null}
                                    </td>
                                  );
                                }
                                if (cid === "bid") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad align-middle text-right xoptions-chain-table__price-col ${gb("bid")}`}
                                    >
                                      <div className="flex flex-col items-end gap-0.5">
                                        <button
                                          type="button"
                                          className="xoptions-contract__bid xoptions-contract__bid--emphasis xoptions-chain-table__quote-major xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight text-right"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedStrike(row.strike);
                                            setLimitPrice(bid.toFixed(2));
                                          }}
                                        >
                                          ${bid.toFixed(2)}
                                        </button>
                                        <span className="xoptions-chain-table__spread-hint xoptions-chain-table__spread-hint--dim font-mono tabular-nums tracking-tight">
                                          {spreadAbs.toFixed(2)} spread
                                        </span>
                                      </div>
                                    </td>
                                  );
                                }
                                if (cid === "ask") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-contract__ask-cell xoptions-chain-table__quote-major xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("ask")}`}
                                    >
                                      <button
                                        type="button"
                                        className="xoptions-contract__ask-cell-btn xoptions-chain-table__quote-major xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight text-right font-semibold"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedStrike(row.strike);
                                          setLimitPrice(ask.toFixed(2));
                                        }}
                                      >
                                        ${ask.toFixed(2)}
                                      </button>
                                    </td>
                                  );
                                }
                                if (cid === "mid") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-chain-table__mid-cell xoptions-chain-table__quote-major xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("mid")}`}
                                    >
                                      ${mid.toFixed(2)}
                                    </td>
                                  );
                                }
                                if (cid === "last") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-chain-table__quote-major xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("last")}`}
                                    >
                                      ${lastPx.toFixed(2)}
                                    </td>
                                  );
                                }
                                if (cid === "be") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-chain-table__price-col xoptions-chain-table__price-figure font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("be")}`}
                                    >
                                      ${be.toFixed(2)}
                                    </td>
                                  );
                                }
                                if (cid === "iv") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-chain-table__flow-metric font-mono tabular-nums tracking-tight align-middle text-right font-semibold ${gb("iv")}`}
                                    >
                                      {ivDisplay}
                                    </td>
                                  );
                                }
                                if (cid === "volume") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-chain-table__heat-cell xoptions-chain-table__flow-metric font-mono tabular-nums tracking-tight text-right align-middle font-semibold ${vol > 500 ? "xoptions-chain-table__vol-hot" : ""} ${gb("volume")}`}
                                    >
                                      {vol.toLocaleString()}
                                    </td>
                                  );
                                }
                                if (cid === "oi") {
                                  return (
                                    <td
                                      key={cid}
                                      className={`xoptions-chain-table__td-pad xoptions-chain-table__heat-cell xoptions-chain-table__flow-metric font-mono tabular-nums tracking-tight text-right align-middle font-semibold ${gb("oi")}`}
                                      style={oiCellStyle}
                                    >
                                      {oiVal.toLocaleString()}
                                    </td>
                                  );
                                }
                                if (cid === "delta") {
                                  return renderGreekTd("delta", "delta", g?.delta, 3);
                                }
                                if (cid === "gamma") {
                                  return renderGreekTd("gamma", "gamma", g?.gamma, 4);
                                }
                                if (cid === "theta") {
                                  return renderGreekTd("theta", "theta", g?.theta_per_day, 3);
                                }
                                if (cid === "vega") {
                                  return renderGreekTd("vega", "vega", g?.vega_per_one_percent_iv, 3);
                                }
                                return null;
                              })}
                              <td className="xoptions-chain-table__select-cell xoptions-chain-table__td-pad text-right align-middle">
                                <button
                                  type="button"
                                  className="xoptions-chain-table__select-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectRow(row.strike);
                                  }}
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
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
                      <span className="inline-flex items-center gap-1">
                        <span className="xoptions-contract__otm-swatch" aria-hidden /> OTM
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
                      Fetching option chain for <span className="font-mono">{u}</span>…
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
                            Fetching option chain for <span className="font-mono">{u}</span>…
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
                  strike={selectedStrike ?? 0}
                  expirationYyyyMmDd={expiration}
                  quantity={qtyOk ? qtyNum : 1}
                  limitPricePerShare={premiumNum}
                  side={side}
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
                strike={selectedStrike ?? 0}
                expirationYyyyMmDd={expiration}
                quantity={qtyOk ? qtyNum : 1}
                limitPricePerShare={premiumNum}
                side={side}
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
