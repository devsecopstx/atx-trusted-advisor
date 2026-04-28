"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
    type ChangeEvent,
    type CSSProperties
} from "react";

import {
    ActivityPulseIcon,
    AddIcon,
    BackIcon,
    DedupeIcon,
    DeleteIcon,
    DownloadIcon,
    EditIcon,
    ExternalLinkIcon,
    SaveIcon,
    UnlinkIcon,
    UploadIcon,
    XMarkIcon
} from "@/app/admin/ui/crud-icons";
import { IconEditButton } from "@/app/ui/icon-edit-control";
import { readFetchJsonBody } from "@/lib/read-fetch-json-body";
import { XF_FONT_SANS_FALLBACK } from "@/lib/xf-font-stacks";
import type { WatchlistRowStatus } from "@/modules/core-admin/types";
import {
    MAX_WATCHLIST_SYMBOLS,
    MAX_WATCHLIST_SYMBOLS_PER_PATCH
} from "@/modules/watchlist/constants";
import {
    parseWatchlistCsv,
    type WatchlistCsvEntry
} from "@/modules/watchlist/parse-watchlist-csv";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

import {
    computeExecutiveMetrics,
    formatPortfolioRiskPct,
    heuristicIvPercentile,
    type WatchlistMetricRow
} from "@/app/watchlist/ui/watchlist-metrics";
import { getSymbolSectorLabel } from "@/modules/watchlist/symbol-sector";

function UpArrowIcon() {
  return (
    <svg aria-hidden fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M12 19V5M12 5l-5 5M12 5l5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function DownArrowIcon() {
  return (
    <svg aria-hidden fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M12 5v14M12 19l-5-5M12 19l5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ReviewListIcon() {
  return (
    <svg aria-hidden fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

type WatchlistChainGlance = {
  contractType: "call" | "put";
  strike: number;
  impliedVolatilityPercent: number;
  openInterest: number;
  optionVolume: number;
  expirationDate: string | null;
};

type WatchlistTechnicals = {
  rsi14: number | null;
  sparkline7d: number[] | null;
};

type WatchlistRow = {
  symbol: string;
  addedAt: string;
  quote: SymbolLookupResult | null;
  lineType?: string;
  strategy?: string;
  quantity?: number;
  entryPrice?: number;
  rationale?: string;
  rowStatus?: WatchlistRowStatus;
  /** From price scanner job (`lastPrice` / `lastUpdatedAt` on symbol row). */
  lastPrice?: number;
  lastUpdatedAt?: string;
  /** Nearest-expiry chain highlight when API is called with chainGlance=1. */
  chainGlance?: WatchlistChainGlance | null;
  /** Technical overlays when API is called with technicals=1. */
  technicals?: WatchlistTechnicals | null;
};

type WatchlistApiData = {
  activeWatchlistId?: string | null;
  watchlists?: Array<{
    id: string;
    name: string;
    symbolCount?: number;
    isDefault?: boolean;
    updatedAt?: string | null;
  }>;
  name?: string;
  symbols?: Array<{
    symbol: string;
    addedAt: string;
    lineType?: string;
    strategy?: string;
    quantity?: number;
    entryPrice?: number;
    rationale?: string;
    rowStatus?: WatchlistRowStatus;
    lastPrice?: number;
    lastUpdatedAt?: string;
  }>;
  symbolsWithQuotes?: WatchlistRow[];
};

function buildRows(data: WatchlistApiData): WatchlistRow[] {
  const base = data.symbolsWithQuotes?.length
    ? data.symbolsWithQuotes
    : (data.symbols ?? []).map((s) => ({
        symbol: s.symbol,
        addedAt: s.addedAt,
        quote: null,
        lineType: s.lineType,
        strategy: s.strategy,
        quantity: s.quantity,
        entryPrice: s.entryPrice,
        rationale: s.rationale,
        rowStatus: s.rowStatus,
        lastPrice: s.lastPrice,
        lastUpdatedAt: s.lastUpdatedAt
      }));
  return base;
}

function chunkSymbols<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

type WatchlistPatchEntry = {
  symbol: string;
  lineType?: string;
  strategy?: string;
  quantity?: number | null;
  entryPrice?: number | null;
  rationale?: string | null;
  rowStatus?: WatchlistRowStatus | null;
};

function normWatchlistField(s?: string): string {
  return (s ?? "").trim();
}

function rowStatusFromSelectValue(v: string): WatchlistRowStatus {
  if (v === "active" || v === "review") {
    return v;
  }
  return "draft";
}

function cloneWatchlistRow(r: WatchlistRow): WatchlistRow {
  return { ...r };
}

/** Rows that exist in both lists; emits PATCH addEntries rows only where metadata changed. */
function buildDirtyAddEntries(baseline: WatchlistRow[], draft: WatchlistRow[]): WatchlistPatchEntry[] {
  const bySym = new Map(baseline.map((row) => [row.symbol, row]));
  const out: WatchlistPatchEntry[] = [];
  for (const d of draft) {
    const b = bySym.get(d.symbol);
    if (!b) {
      continue;
    }
    if (
      normWatchlistField(b.lineType) === normWatchlistField(d.lineType) &&
      normWatchlistField(b.strategy) === normWatchlistField(d.strategy) &&
      normWatchlistField(b.rationale) === normWatchlistField(d.rationale) &&
      b.quantity === d.quantity &&
      b.entryPrice === d.entryPrice &&
      b.rowStatus === d.rowStatus
    ) {
      continue;
    }
    const entry: WatchlistPatchEntry = { symbol: d.symbol };
    if (normWatchlistField(b.lineType) !== normWatchlistField(d.lineType)) {
      entry.lineType = d.lineType?.trim() ?? "";
    }
    if (normWatchlistField(b.strategy) !== normWatchlistField(d.strategy)) {
      entry.strategy = d.strategy?.trim() ?? "";
    }
    if (normWatchlistField(b.rationale) !== normWatchlistField(d.rationale)) {
      entry.rationale = d.rationale?.trim() ?? "";
    }
    if (b.quantity !== d.quantity) {
      entry.quantity =
        d.quantity !== undefined && Number.isFinite(d.quantity) ? d.quantity : null;
    }
    if (b.entryPrice !== d.entryPrice) {
      entry.entryPrice =
        d.entryPrice !== undefined && Number.isFinite(d.entryPrice) ? d.entryPrice : null;
    }
    if (b.rowStatus !== d.rowStatus) {
      entry.rowStatus = d.rowStatus ?? null;
    }
    out.push(entry);
  }
  return out;
}

type WatchlistSortColumn =
  | "instrument"
  | "targetEntry"
  | "iv"
  | "ivRank"
  | "optionsVolume"
  | "oi"
  | "distToTarget"
  | "quickScore";

/** Whole-dollar notional: round(100× live quote) for sort and display. */
function getTargetEntryNumeric(row: WatchlistRow): number | null {
  const entry = row.entryPrice;
  if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
    return Math.round(100 * entry);
  }
  const px = row.quote?.price;
  if (typeof px === "number" && Number.isFinite(px)) {
    return Math.round(100 * px);
  }
  return null;
}

/** Notional dollars at 100× current quote, rounded to nearest whole dollar. */
function formatTargetEntryCell(row: WatchlistRow): string {
  const v = getTargetEntryNumeric(row);
  if (v !== null) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  }
  return "—";
}

function getIvSortValue(row: WatchlistRow): number | null {
  const iv = row.chainGlance?.impliedVolatilityPercent;
  return iv != null && Number.isFinite(iv) ? iv : null;
}

function getOiSortValue(row: WatchlistRow): number | null {
  const oi = row.chainGlance?.openInterest;
  return oi != null && Number.isFinite(oi) ? oi : null;
}

function tieSymbol(a: WatchlistRow, b: WatchlistRow): number {
  return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
}

/** Sort numeric column; nulls last; tie-break by symbol. */
function compareNumericColumn(
  mult: number,
  va: number | null,
  vb: number | null,
  a: WatchlistRow,
  b: WatchlistRow
): number {
  if (va === null && vb === null) {
    return tieSymbol(a, b);
  }
  if (va === null) {
    return 1;
  }
  if (vb === null) {
    return -1;
  }
  const cmp = va - vb;
  if (cmp !== 0) {
    return mult * cmp;
  }
  return tieSymbol(a, b);
}

function truncateCompanyBlurb(name: string, maxLen: number): string {
  const t = name.trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

const WATCHLIST_RATIONALE_PREVIEW_MAX_CHARS = 180;

function getRationalePreview(raw?: string): string {
  const compact = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!compact) {
    return "";
  }
  if (compact.length <= WATCHLIST_RATIONALE_PREVIEW_MAX_CHARS) {
    return compact;
  }
  return `${compact.slice(0, WATCHLIST_RATIONALE_PREVIEW_MAX_CHARS - 1)}…`;
}

function formatUsd2(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function applyWatchlistSort(
  list: WatchlistRow[],
  sortColumn: WatchlistSortColumn,
  sortDir: "asc" | "desc"
): WatchlistRow[] {
  const mult = sortDir === "asc" ? 1 : -1;
  const out = [...list];
  out.sort((a, b) => {
    if (sortColumn === "instrument") {
      return mult * tieSymbol(a, b);
    }
    if (sortColumn === "targetEntry") {
      return compareNumericColumn(mult, getTargetEntryNumeric(a), getTargetEntryNumeric(b), a, b);
    }
    if (sortColumn === "iv") {
      return compareNumericColumn(mult, getIvSortValue(a), getIvSortValue(b), a, b);
    }
    if (sortColumn === "ivRank") {
      return compareNumericColumn(mult, getIvRankSortValue(a), getIvRankSortValue(b), a, b);
    }
    if (sortColumn === "optionsVolume") {
      return compareNumericColumn(mult, getOptionVolumeSortValue(a), getOptionVolumeSortValue(b), a, b);
    }
    if (sortColumn === "oi") {
      return compareNumericColumn(mult, getOiSortValue(a), getOiSortValue(b), a, b);
    }
    if (sortColumn === "distToTarget") {
      return compareNumericColumn(mult, distToTargetPct(a), distToTargetPct(b), a, b);
    }
    if (sortColumn === "quickScore") {
      return compareNumericColumn(mult, quickScore(a), quickScore(b), a, b);
    }
    return tieSymbol(a, b);
  });
  return out;
}

function formatSpotCell(row: WatchlistRow): string {
  const px = row.quote?.price;
  if (typeof px === "number" && Number.isFinite(px)) {
    return px.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
  return "—";
}

function formatOiCell(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(Math.round(n));
}

function formatLegCell(row: WatchlistRow): string {
  const g = row.chainGlance;
  if (!g) {
    return "—";
  }
  return `${g.contractType} ${g.strike.toFixed(2)}`;
}

function formatCatalystCell(row: WatchlistRow): string {
  const iso = row.chainGlance?.expirationDate;
  if (!iso) {
    return "—";
  }
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const daysOut = Math.max(0, Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  if (daysOut <= 7) {
    return `Exp ${iso} • ${daysOut}d`;
  }
  return `Exp ${iso}`;
}

function formatRsiCell(row: WatchlistRow): string {
  const rsi = row.technicals?.rsi14;
  if (rsi == null || !Number.isFinite(rsi)) {
    return "—";
  }
  if (rsi < 30) {
    return `${rsi.toFixed(1)} (OS)`;
  }
  if (rsi > 70) {
    return `${rsi.toFixed(1)} (OB)`;
  }
  return rsi.toFixed(1);
}

function distToTargetPct(row: WatchlistRow): number | null {
  const spot = row.quote?.price;
  const target = row.entryPrice;
  if (
    spot == null ||
    target == null ||
    !Number.isFinite(spot) ||
    !Number.isFinite(target) ||
    spot <= 0 ||
    target <= 0
  ) {
    return null;
  }
  return ((target - spot) / spot) * 100;
}

function formatDistToTarget(row: WatchlistRow): string {
  const pct = distToTargetPct(row);
  if (pct == null) {
    return "—";
  }
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function getOptionVolumeSortValue(row: WatchlistRow): number | null {
  const vol = row.chainGlance?.optionVolume;
  return vol != null && Number.isFinite(vol) ? vol : null;
}

function getIvRankSortValue(row: WatchlistRow): number | null {
  const iv = row.chainGlance?.impliedVolatilityPercent;
  if (iv == null || !Number.isFinite(iv)) {
    return null;
  }
  return heuristicIvPercentile(iv);
}

function quickScore(row: WatchlistRow): number | null {
  const ivRank = getIvRankSortValue(row);
  const oi = row.chainGlance?.openInterest;
  const volume = row.chainGlance?.optionVolume;
  if (ivRank == null || oi == null || volume == null || !Number.isFinite(oi) || !Number.isFinite(volume)) {
    return null;
  }
  const dist = distToTargetPct(row);
  const targetProximity = dist == null ? 0.5 : Math.max(0, 1 - Math.min(Math.abs(dist), 25) / 25);
  const rsi = row.technicals?.rsi14;
  const rsiSignal =
    rsi == null || !Number.isFinite(rsi) ? 0.35 : rsi < 30 || rsi > 70 ? 1 : Math.abs(rsi - 50) / 25;
  const catalyst = row.chainGlance?.expirationDate;
  const catalystScore = catalyst ? 1 : 0.35;
  const liquidity = Math.min(1, Math.log1p(Math.max(0, oi) + Math.max(0, volume)) / Math.log1p(250_000));
  const score01 =
    (ivRank / 100) * 0.28 +
    liquidity * 0.3 +
    targetProximity * 0.2 +
    rsiSignal * 0.12 +
    catalystScore * 0.1;
  return Math.round(score01 * 100);
}

function Sparkline7d({ values }: { values: number[] | null | undefined }) {
  if (!values || values.length < 2) {
    return <span className="xf-watchlist-sparkline-placeholder">—</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      aria-label="7-day sparkline"
      className="xf-watchlist-sparkline"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <polyline fill="none" points={points} stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}

const WATCHLIST_VIRTUAL_ROW_ESTIMATE_PX = 64;
const WATCHLIST_VIRTUAL_MIN_ROWS = 10;

type WatchlistRowTrProps = {
  row: WatchlistRow;
  editMode: boolean;
  mutating: boolean;
  removingThisSymbol: boolean;
  updateDraftRow: (
    symbol: string,
    partial: Partial<
      Pick<
        WatchlistRow,
        "lineType" | "strategy" | "quantity" | "entryPrice" | "rationale" | "rowStatus"
      >
    >
  ) => void;
  onRemoveSymbol: (symbol: string) => void;
  rowClassName?: string;
  rowStyle?: CSSProperties;
  portfolioTotalUsd: number;
  listLoadedAtLabel: string;
  patchRowMeta: (symbol: string, partial: { rationale?: string; rowStatus?: WatchlistRowStatus }) => Promise<void>;
  patchRowEntryPrice: (symbol: string, entryPrice: number) => Promise<void>;
  aiSuggestBusy: boolean;
  onAiSuggest: (row: WatchlistRow) => void;
  onShowQuote: (row: WatchlistRow) => void;
};

const WatchlistRowTr = memo(function WatchlistRowTr({
  row,
  editMode,
  mutating,
  removingThisSymbol,
  updateDraftRow,
  onRemoveSymbol,
  rowClassName,
  rowStyle,
  portfolioTotalUsd,
  listLoadedAtLabel,
  patchRowMeta,
  patchRowEntryPrice,
  aiSuggestBusy,
  onAiSuggest,
  onShowQuote
}: WatchlistRowTrProps) {
  const te = getTargetEntryNumeric(row);
  const riskPct = formatPortfolioRiskPct(te, portfolioTotalUsd);
  const ivRank = getIvRankSortValue(row);
  const optionsVolume = getOptionVolumeSortValue(row);
  const distToTargetDisplay = formatDistToTarget(row);
  const quickScoreValue = quickScore(row);
  const lastPrim = formatLastUpdateCell(row);
  const companyFull = row.quote?.companyName?.trim() ?? "";
  const companyBlurb = companyFull ? truncateCompanyBlurb(companyFull, 52) : "";
  const wkLo = row.quote?.fiftyTwoWeekLow;
  const wkHi = row.quote?.fiftyTwoWeekHigh;
  const has52w =
    typeof wkLo === "number" &&
    Number.isFinite(wkLo) &&
    typeof wkHi === "number" &&
    Number.isFinite(wkHi);
  const lastTitle =
    lastPrim !== "—"
      ? undefined
      : listLoadedAtLabel
        ? `Last refreshed: ${listLoadedAtLabel}`
        : undefined;
  const [rationaleDialogOpen, setRationaleDialogOpen] = useState(false);
  const [rationaleDialogEditing, setRationaleDialogEditing] = useState(false);
  const [rationaleDraft, setRationaleDraft] = useState(row.rationale ?? "");
  const rationaleHasValue = (row.rationale ?? "").trim().length > 0;
  const rationalePreview = useMemo(() => getRationalePreview(row.rationale), [row.rationale]);

  const closeRationaleDialog = () => {
    setRationaleDialogOpen(false);
    setRationaleDialogEditing(false);
    setRationaleDraft(row.rationale ?? "");
  };

  const saveRationaleDialog = async () => {
    const prev = (row.rationale ?? "").trim();
    const next = rationaleDraft.trim();
    if (prev !== next) {
      await patchRowMeta(row.symbol, { rationale: next });
    }
    setRationaleDialogOpen(false);
  };

  return (
    <tr className={rowClassName} style={rowStyle}>
      <td className="xf-watchlist-table-icon-cell">
        <WatchlistIconBadge logoUrl={row.quote?.logoUrl} symbol={row.symbol} />
      </td>
      <td>
        <div className="xf-watchlist-sym-cell">
          <div className="xf-watchlist-sym-cell__row">
            <span className="xf-watchlist-sym-cell__label">{row.symbol}</span>
          </div>
          {companyBlurb ? (
            <div className="xf-watchlist-sym-cell__company" title={companyFull}>
              {companyBlurb}
            </div>
          ) : (
            <div className="xf-watchlist-sym-cell__company xf-watchlist-sym-cell__company--muted">—</div>
          )}
          <div className="xf-watchlist-sym-cell__industry">{getSymbolSectorLabel(row.symbol)}</div>
          <div className="xf-watchlist-sym-cell__sparkline">
            <Sparkline7d values={row.technicals?.sparkline7d} />
          </div>
        </div>
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-spot-cell">
        <div className="xf-watchlist-spot-cell__px">{formatSpotCell(row)}</div>
        {has52w ? (
          <div className="xf-watchlist-spot-cell__52w" title="52-week range (trailing)">
            <span className="xf-watchlist-spot-cell__52w-label">52w</span>{" "}
            {formatUsd2(wkLo)} – {formatUsd2(wkHi)}
          </div>
        ) : null}
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">
        <span className="xf-watchlist-iv-wrap">
          <span>{row.chainGlance?.impliedVolatilityPercent != null ? `${row.chainGlance.impliedVolatilityPercent.toFixed(1)}%` : "—"}</span>
        </span>
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">
        <span
          className={`xf-watchlist-iv-rank-badge${ivRank != null && ivRank >= 85 ? " xf-watchlist-iv-rank-badge--hot" : ivRank != null && ivRank >= 70 ? " xf-watchlist-iv-rank-badge--elevated" : ""}`}
          title="Heuristic IV rank percentile"
        >
          {ivRank != null ? `${ivRank}%` : "—"}
        </span>
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">
        {optionsVolume != null ? formatOiCell(optionsVolume) : "—"}
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">
        {row.chainGlance != null ? formatOiCell(row.chainGlance.openInterest) : "—"}
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">{formatLegCell(row)}</td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">{formatCatalystCell(row)}</td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">{formatRsiCell(row)}</td>
      <td className="xf-watchlist-table-mono">
        {editMode ? (
          <div className="xf-watchlist-edit-stack">
            <input
              aria-label={`${row.symbol} quantity`}
              className="xf-watchlist-table-input"
              inputMode="decimal"
              placeholder="Quantity"
              type="text"
              value={row.quantity === undefined ? "" : String(row.quantity)}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v === "") {
                  updateDraftRow(row.symbol, { quantity: undefined });
                  return;
                }
                const n = Number(v);
                updateDraftRow(row.symbol, {
                  quantity: Number.isFinite(n) ? n : undefined
                });
              }}
            />
            <input
              aria-label={`${row.symbol} entry price`}
              className="xf-watchlist-table-input"
              inputMode="decimal"
              placeholder="Entry price"
              type="text"
              value={row.entryPrice === undefined ? "" : String(row.entryPrice)}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v === "") {
                  updateDraftRow(row.symbol, { entryPrice: undefined });
                  return;
                }
                const n = Number(v);
                updateDraftRow(row.symbol, {
                  entryPrice: Number.isFinite(n) ? n : undefined
                });
              }}
            />
            {row.quote?.price != null && Number.isFinite(row.quote.price) ? (
              <span className="xf-watchlist-table-hint" title="100 × live quote price">
                100× price: {formatTargetEntryCell(row)}
              </span>
            ) : null}
          </div>
        ) : (
          formatTargetEntryCell(row)
        )}
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">{riskPct}</td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">{distToTargetDisplay}</td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">{quickScoreValue != null ? quickScoreValue : "—"}</td>
      <td className="xf-watchlist-rationale-cell">
        {editMode ? (
          <textarea
            aria-label={`${row.symbol} rationale`}
            className="xf-watchlist-rationale-input"
            placeholder="Thesis (required for Active)"
            rows={2}
            value={row.rationale ?? ""}
            onChange={(e) => updateDraftRow(row.symbol, { rationale: e.target.value })}
          />
        ) : (
          <div
            className={`xf-watchlist-rationale-preview${!rationaleHasValue ? " xf-watchlist-rationale-preview--empty" : ""}`}
          >
            {rationaleHasValue ? rationalePreview : "No rationale yet. Add one before marking Active."}
          </div>
        )}
        <div className="xf-watchlist-rationale-actions">
          {!editMode ? (
            <button
              className="xf-watchlist-rationale-expand-link"
              disabled={mutating}
              type="button"
              onClick={() => {
                setRationaleDraft(row.rationale ?? "");
                setRationaleDialogEditing(false);
                setRationaleDialogOpen(true);
              }}
            >
              Expand
            </button>
          ) : null}
          <button
            className="xf-watchlist-ai-suggest"
            disabled={mutating || aiSuggestBusy}
            type="button"
            onClick={() => onAiSuggest(row)}
          >
            ✦ AI Suggest
          </button>
        </div>
        {!editMode && rationaleDialogOpen ? (
          <div className="xf-watchlist-rationale-modal-backdrop" role="presentation" onClick={closeRationaleDialog}>
            <div
              aria-label={`${row.symbol} rationale`}
              aria-modal="true"
              className="xf-watchlist-rationale-modal"
              role="dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="xf-watchlist-rationale-modal__title">{row.symbol} rationale</h3>
              {rationaleDialogEditing ? (
                <textarea
                  aria-label={`${row.symbol} rationale editor`}
                  className="xf-watchlist-rationale-editor"
                  placeholder="One-line thesis"
                  rows={8}
                  value={rationaleDraft}
                  onChange={(e) => setRationaleDraft(e.target.value)}
                />
              ) : (
                <div className="xf-watchlist-rationale-modal__content">
                  {rationaleDraft.trim().length > 0
                    ? rationaleDraft
                    : "No rationale set yet. Click Edit to add one."}
                </div>
              )}
              <div className="xf-watchlist-rationale-modal__actions">
                <button className="xf-watchlist-rationale-modal__btn" type="button" onClick={closeRationaleDialog}>
                  Close
                </button>
                {rationaleDialogEditing ? (
                  <>
                    <button
                      className="xf-watchlist-rationale-modal__btn xf-watchlist-rationale-modal__btn--secondary"
                      type="button"
                      onClick={() => {
                        setRationaleDraft(row.rationale ?? "");
                        setRationaleDialogEditing(false);
                      }}
                    >
                      Cancel edit
                    </button>
                    <button
                      className="xf-watchlist-rationale-modal__btn xf-watchlist-rationale-modal__btn--primary"
                      disabled={mutating}
                      type="button"
                      onClick={() => void saveRationaleDialog()}
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    className="xf-watchlist-rationale-modal__btn xf-watchlist-rationale-modal__btn--primary"
                    disabled={mutating}
                    type="button"
                    onClick={() => setRationaleDialogEditing(true)}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </td>
      <td className="xf-watchlist-table-mono">
        {editMode ? (
          <select
            aria-label={`${row.symbol} row status`}
            className="xf-watchlist-status-select"
            value={row.rowStatus ?? "draft"}
            onChange={(e) => {
              updateDraftRow(row.symbol, { rowStatus: rowStatusFromSelectValue(e.target.value) });
            }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="review">Review</option>
          </select>
        ) : (
          <select
            aria-label={`${row.symbol} row status`}
            className="xf-watchlist-status-select"
            value={row.rowStatus ?? "draft"}
            disabled={mutating}
            onChange={(e) => {
              const v = rowStatusFromSelectValue(e.target.value);
              const rationale = (row.rationale ?? "").trim();
              if (v === "active" && rationale.length === 0) {
                window.alert("Add a rationale before marking this row Active.");
                return;
              }
              void patchRowMeta(row.symbol, { rowStatus: v, rationale: row.rationale });
            }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="review">Review</option>
          </select>
        )}
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-last-up" title={lastTitle}>
        {lastPrim}
      </td>
      <td className="xf-watchlist-actions-cell">
        <div className="xf-watchlist-row-actions-inline">
          <button
            aria-label={`Review ${row.symbol} leg`}
            className="xf-watchlist-row-action-btn"
            disabled={mutating}
            title="Review leg"
            type="button"
            onClick={() => void patchRowMeta(row.symbol, { rowStatus: "review", rationale: row.rationale })}
          >
            <ReviewListIcon />
          </button>
          <button
            aria-label={`Show quote details for ${row.symbol}`}
            className="xf-watchlist-row-action-btn"
            disabled={mutating}
            title="View quote"
            type="button"
            onClick={() => onShowQuote(row)}
          >
            <ActivityPulseIcon className="crud-icon" />
          </button>
          <button
            aria-label={`Increase target entry for ${row.symbol}`}
            className="xf-watchlist-row-action-btn"
            disabled={mutating}
            title="Increase target entry"
            type="button"
            onClick={() => {
              const basis =
                typeof row.entryPrice === "number" && Number.isFinite(row.entryPrice) && row.entryPrice > 0
                  ? row.entryPrice
                  : typeof row.quote?.price === "number" && Number.isFinite(row.quote.price) && row.quote.price > 0
                    ? row.quote.price
                    : null;
              if (basis == null) {
                return;
              }
              const next = Math.round(basis * 1.01 * 100) / 100;
              void patchRowEntryPrice(row.symbol, next);
            }}
          >
            <UpArrowIcon />
          </button>
          <button
            aria-label={`Decrease target entry for ${row.symbol}`}
            className="xf-watchlist-row-action-btn"
            disabled={mutating}
            title="Decrease target entry"
            type="button"
            onClick={() => {
              const basis =
                typeof row.entryPrice === "number" && Number.isFinite(row.entryPrice) && row.entryPrice > 0
                  ? row.entryPrice
                  : typeof row.quote?.price === "number" && Number.isFinite(row.quote.price) && row.quote.price > 0
                    ? row.quote.price
                    : null;
              if (basis == null) {
                return;
              }
              const next = Math.round(Math.max(0.01, basis * 0.99) * 100) / 100;
              void patchRowEntryPrice(row.symbol, next);
            }}
          >
            <DownArrowIcon />
          </button>
          <button
            aria-label={`Open ${row.symbol} in xOptions preflight`}
            className="xf-watchlist-row-action-link"
            title="Add to xOptions preflight"
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                symbol: row.symbol,
                step: "4"
              });
              if (row.chainGlance?.expirationDate) {
                params.set("expiration", row.chainGlance.expirationDate);
              }
              if (
                row.chainGlance?.strike != null &&
                Number.isFinite(row.chainGlance.strike) &&
                row.chainGlance.strike > 0
              ) {
                params.set("strike", row.chainGlance.strike.toFixed(2));
                params.set("contractType", row.chainGlance.contractType);
              }
              window.location.assign(`/xoptions?${params.toString()}`);
            }}
          >
            <ExternalLinkIcon className="crud-icon" />
          </button>
          <button
            aria-label={`Delete ${row.symbol} from watchlist`}
            className="xf-watchlist-row-delete-btn"
            disabled={(mutating && !editMode) || removingThisSymbol}
            title="Remove from watchlist"
            type="button"
            onClick={() => void onRemoveSymbol(row.symbol)}
          >
            <DeleteIcon className="crud-icon" />
          </button>
        </div>
      </td>
    </tr>
  );
});

function watchlistSymbolInitialsStyle(symbol: string): CSSProperties {
  const seed = symbol.trim().toUpperCase();
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return {
    background: `hsl(${hue} 70% 20%)`,
    color: `hsl(${hue} 80% 92%)`
  };
}

function WatchlistIconBadge({ logoUrl, symbol }: { logoUrl?: string | null; symbol: string }) {
  const [broken, setBroken] = useState(false);
  const trimmedLogo = (logoUrl ?? "").trim();
  const showRemote = Boolean(trimmedLogo) && !broken;
  const letters = useMemo(() => {
    const s = symbol.trim().toUpperCase();
    return s.slice(0, 2) || "?";
  }, [symbol]);
  const initialsStyle = useMemo(() => watchlistSymbolInitialsStyle(symbol), [symbol]);

  return (
    <div className="xf-watchlist-icon-badge xf-watchlist-icon-badge--stack">
      <div aria-hidden className="xf-watchlist-icon-badge__initials" style={initialsStyle}>
        {letters}
      </div>
      {showRemote ? (
        // eslint-disable-next-line @next/next/no-img-element -- IEX/Yahoo CDN from quote lookup
        <img
          alt=""
          className="xf-watchlist-icon-badge__logo"
          decoding="async"
          height={28}
          loading="lazy"
          referrerPolicy="no-referrer"
          src={trimmedLogo}
          width={28}
          onError={() => setBroken(true)}
        />
      ) : null}
    </div>
  );
}

function formatLastUpdateCell(row: WatchlistRow): string {
  if (row.lastUpdatedAt) {
    try {
      const d = new Date(row.lastUpdatedAt);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString();
      }
    } catch {
      /* keep — */
    }
  }
  return "—";
}

function toCsv(rows: WatchlistRow[]): string {
  const headers = [
    "Symbol",
    "Company",
    "Price",
    "ChangePct",
    "Volume",
    "Quantity",
    "Entry Price",
    "Target entry (100x price)",
    "Last update",
    "Rationale",
    "RowStatus"
  ];
  const lines = rows.map((r) => {
    const q = r.quote;
    const company = (q?.companyName ?? r.symbol).replaceAll('"', '""');
    const te = getTargetEntryNumeric(r);
    const target100 = te !== null ? String(te) : "";
    let lastUp = "";
    if (r.lastUpdatedAt) {
      try {
        const d = new Date(r.lastUpdatedAt);
        if (!Number.isNaN(d.getTime())) {
          lastUp = d.toISOString();
        }
      } catch {
        lastUp = "";
      }
    }
    const rat = (r.rationale ?? "").replaceAll('"', '""');
    return [
      r.symbol,
      `"${company}"`,
      q?.price ?? "",
      q?.changePercent ?? "",
      q?.volume ?? "",
      r.quantity ?? "",
      r.entryPrice ?? "",
      target100,
      lastUp,
      `"${rat}"`,
      r.rowStatus ?? "draft"
    ].join(",");
  });
  return [headers.join(","), ...lines].join("\n");
}

const WATCHLIST_LIST_NAV_COLLAPSED_KEY = "xf-watchlist-list-sidebar-collapsed";
const WATCHLIST_PORTFOLIO_TOTAL_LS_KEY = "xf_watchlist_portfolio_total_usd_v1";

function stripMarkdownishFirstLine(raw: string): string {
  const t = raw.trim().replace(/^#+\s*/m, "").split(/\n/)[0]?.trim() ?? "";
  return t.slice(0, 280);
}

function WatchlistSidebarChevron({ direction }: { direction: "left" | "right" }) {
  if (direction === "left") {
    return (
      <svg
        aria-hidden
        className="xf-watchlist-sidebar-toggle__icon"
        fill="none"
        height="18"
        viewBox="0 0 24 24"
        width="18"
      >
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      className="xf-watchlist-sidebar-toggle__icon"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function buildImportWorkload(
  entries: WatchlistCsvEntry[],
  currentSymbols: string[]
): { workload: WatchlistCsvEntry[]; skippedNewCount: number } {
  const seen = new Set(currentSymbols);
  let addBudget = Math.max(0, MAX_WATCHLIST_SYMBOLS - currentSymbols.length);
  const workload: WatchlistCsvEntry[] = [];
  let skippedNewCount = 0;

  for (const e of entries) {
    if (seen.has(e.symbol)) {
      workload.push(e);
      continue;
    }
    if (addBudget > 0) {
      workload.push(e);
      seen.add(e.symbol);
      addBudget -= 1;
    } else {
      skippedNewCount += 1;
    }
  }

  return { workload, skippedNewCount };
}

export type WatchlistConsoleProps = {
  portfolioId: string;
  isAdmin: boolean;
  /** API base including `/api/.../portfolios` (no trailing slash). Default `/api/portfolios`. */
  watchlistApiPrefix?: string;
  /** `admin` — footer links to Hub; `app_user` — portfolio + optional Hub link. */
  footerMode?: "app_user" | "admin";
  /** Inline in portfolio desk: hide standalone footer CTAs. */
  variant?: "page" | "embedded";
  /** When set with `portfolioStockSymbolsUpper`, shows per-row “Add to holdings” for symbols not in this set. */
  addToHoldingsAccountIdHex?: string | null;
  /** Uppercased tickers that already have a stock position anywhere in this portfolio. */
  portfolioStockSymbolsUpper?: readonly string[];
  /** Fired after watchlist rows change (PATCH/import/remove) so compact IV/OI rail can reload. */
  onWatchlistMutated?: () => void;
  /** Fired after holdings mutations from watchlist actions (embedded workspace). */
  onBookMutated?: () => void;
  /** App-user shell already has a workspace rail; hide local watchlist sidebar to avoid double sidebars. */
  showLocalSidebar?: boolean;
};

export function WatchlistConsole({
  portfolioId,
  isAdmin,
  watchlistApiPrefix = "/api/portfolios",
  footerMode = "app_user",
  variant = "page",
  onWatchlistMutated,
  showLocalSidebar = true
}: WatchlistConsoleProps) {
  const watchlistBaseUrl = `${watchlistApiPrefix}/${encodeURIComponent(portfolioId)}/watchlist`;
  const [listName, setListName] = useState("Default");
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRows, setDraftRows] = useState<WatchlistRow[]>([]);
  const editBaselineRef = useRef<{ name: string; rows: WatchlistRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [listNavCollapsed, setListNavCollapsed] = useState(true);
  const [portfolioTotalInput, setPortfolioTotalInput] = useState("");
  const [listLoadedAtLabel, setListLoadedAtLabel] = useState("");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const [quotePanelSymbol, setQuotePanelSymbol] = useState<string | null>(null);
  const [aiSuggestSymbol, setAiSuggestSymbol] = useState<string | null>(null);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("");
  const [availableWatchlists, setAvailableWatchlists] = useState<
    Array<{ id: string; name: string; symbolCount: number; isDefault: boolean }>
  >([]);
  const [creatingWatchlist, setCreatingWatchlist] = useState(false);
  const [sort, setSort] = useState<{ column: WatchlistSortColumn; dir: "asc" | "desc" }>({
    column: "instrument",
    dir: "asc"
  });
  const [, startTransition] = useTransition();
  const tableScrollParentRef = useRef<HTMLDivElement>(null);

  const watchlistFetchQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("quotes", "1");
    params.set("chainGlance", "1");
    params.set("technicals", "1");
    const selectedId = selectedWatchlistId.trim();
    if (selectedId) {
      params.set("watchlistId", selectedId);
    }
    return params.toString();
  }, [selectedWatchlistId]);

  const toggleWatchlistSort = useCallback((column: WatchlistSortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { column, dir: column === "instrument" ? "asc" : "desc" }
    );
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(WATCHLIST_LIST_NAV_COLLAPSED_KEY);
      if (v === "false") {
        setListNavCollapsed(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleListNav = useCallback(() => {
    setListNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(WATCHLIST_LIST_NAV_COLLAPSED_KEY, next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${watchlistBaseUrl}?${watchlistFetchQuery}`, { credentials: "include" });
      const { json } = await readFetchJsonBody<{ data?: WatchlistApiData; error?: string }>(res);
      if (!res.ok) {
        throw new Error(
          json.error ??
            (res.status === 429
              ? "Too many requests. Please wait a moment and retry."
              : "Failed to load watchlist")
        );
      }
      if (!json.data) {
        throw new Error("Invalid response");
      }
      startTransition(() => {
        setListName(json.data!.name ?? "Default");
        setRows(buildRows(json.data!));
        const listRows = (json.data?.watchlists ?? [])
          .filter((row) => typeof row.id === "string" && row.id.trim().length > 0)
          .map((row) => ({
            id: row.id,
            name: row.name?.trim() || "Untitled watchlist",
            symbolCount:
              typeof row.symbolCount === "number" && Number.isFinite(row.symbolCount)
                ? row.symbolCount
                : 0,
            isDefault: row.isDefault === true
          }));
        setAvailableWatchlists(listRows);
        if (typeof json.data?.activeWatchlistId === "string" && json.data.activeWatchlistId.trim()) {
          setSelectedWatchlistId(json.data.activeWatchlistId.trim());
        } else if (listRows.length > 0 && !selectedWatchlistId.trim()) {
          setSelectedWatchlistId(listRows[0]!.id);
        }
        setListLoadedAtLabel(new Date().toLocaleString());
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedWatchlistId, startTransition, watchlistBaseUrl, watchlistFetchQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(WATCHLIST_PORTFOLIO_TOTAL_LS_KEY);
      if (v) {
        setPortfolioTotalInput(v);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSymbolSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const executePatch = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${watchlistBaseUrl}?${watchlistFetchQuery}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const { json } = await readFetchJsonBody<{ data?: WatchlistApiData; error?: string }>(res);
    if (!res.ok) {
      throw new Error(
        json.error ??
          (res.status === 429 ? "Too many requests. Please wait a moment and retry." : "Update failed")
      );
    }
    if (json.data) {
      startTransition(() => {
        setListName(json.data!.name ?? "Default");
        setRows(buildRows(json.data!));
      });
    }
  }, [watchlistBaseUrl, watchlistFetchQuery, startTransition]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setMutating(true);
      setError(null);
      try {
        await executePatch(body);
        onWatchlistMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setMutating(false);
        setRemovingSymbol(null);
      }
    },
    [executePatch, onWatchlistMutated]
  );

  const patchRowMeta = useCallback(
    async (symbol: string, partial: { rationale?: string; rowStatus?: WatchlistRowStatus }) => {
      if (partial.rowStatus === "active") {
        const rationale =
          partial.rationale?.trim() ??
          rows.find((x) => x.symbol === symbol)?.rationale?.trim() ??
          "";
        if (!rationale) {
          window.alert("Save a non-empty rationale before marking Active.");
          return;
        }
      }
      setMutating(true);
      setError(null);
      try {
        await executePatch({ addEntries: [{ symbol, ...partial }] });
        onWatchlistMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setMutating(false);
      }
    },
    [executePatch, onWatchlistMutated, rows]
  );

  const patchRowEntryPrice = useCallback(
    async (symbol: string, entryPrice: number) => {
      if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        return;
      }
      setMutating(true);
      setError(null);
      try {
        await executePatch({ addEntries: [{ symbol, entryPrice }] });
        onWatchlistMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setMutating(false);
      }
    },
    [executePatch, onWatchlistMutated]
  );

  const onAiSuggestRow = useCallback(
    async (row: WatchlistRow) => {
      setAiSuggestSymbol(row.symbol);
      setError(null);
      try {
        const iv = row.chainGlance?.impliedVolatilityPercent;
        const spot = row.quote?.price;
        const sector = getSymbolSectorLabel(row.symbol);
        const msg = `Generate exactly one concise line (max 220 characters) of options-income thesis for ${row.symbol} using implied vol ${iv ?? "n/a"}%, spot ${spot ?? "n/a"}, sector ${sector}. Plain sentence only, no bullets.`;
        const res = await fetch("/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: msg, portfolioId })
        });
        const raw = (await res.json().catch(() => ({}))) as { error?: string; data?: { response?: string } };
        if (!res.ok) {
          throw new Error(raw.error ?? "AI request failed");
        }
        const text = stripMarkdownishFirstLine(String(raw.data?.response ?? ""));
        if (!text.trim()) {
          throw new Error("Empty AI response");
        }
        await executePatch({ addEntries: [{ symbol: row.symbol, rationale: text }] });
        onWatchlistMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI suggest failed");
      } finally {
        setAiSuggestSymbol(null);
      }
    },
    [executePatch, onWatchlistMutated, portfolioId]
  );

  const onExportAdvisorPdf = useCallback(() => {
    const w = window.open("", "_blank");
    if (!w) {
      return;
    }
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const bodyRows = rows
      .map((r) => {
        const te = getTargetEntryNumeric(r);
        const iv = r.chainGlance?.impliedVolatilityPercent;
        return `<tr><td>${esc(r.symbol)}</td><td>${r.quote?.price ?? ""}</td><td>${iv ?? ""}</td><td>${te ?? ""}</td><td>${esc(r.rationale ?? "")}</td></tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Watchlist — advisor</title>
<style>
body{font-family:${XF_FONT_SANS_FALLBACK};background:#090909;color:#f6f8fc;padding:24px;}
h1{color:#8b5cf6;font-size:18px;} .muted{color:#888f9f;font-size:12px;} table{width:100%;border-collapse:collapse;font-size:12px;}
th,td{border:1px solid #333;padding:6px;text-align:left;} th{color:#b5bac6;}
</style></head><body>
<h1>aTx⚡Finance — Watchlist export</h1>
<p class="muted">For discussion only — not investment advice. Past performance does not guarantee future results.</p>
<table><thead><tr><th>Sym</th><th>Spot</th><th>IV</th><th>Target 100×</th><th>Rationale</th></tr></thead><tbody>
${bodyRows}
</tbody></table>
<p class="muted">Options involve risk. Short premium strategies carry assignment and gap risk.</p>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    w.document.write(html);
    w.document.close();
  }, [rows]);

  const onPortfolioTotalBlur = useCallback(() => {
    try {
      localStorage.setItem(WATCHLIST_PORTFOLIO_TOTAL_LS_KEY, portfolioTotalInput.trim());
    } catch {
      /* ignore */
    }
  }, [portfolioTotalInput]);

  const onCreateWatchlist = useCallback(async () => {
    const raw = window.prompt("Name this new watchlist:");
    if (raw == null) {
      return;
    }
    const name = raw.trim();
    if (!name) {
      window.alert("Watchlist name cannot be empty.");
      return;
    }
    setCreatingWatchlist(true);
    setError(null);
    try {
      const response = await fetch(watchlistBaseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name })
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: { id?: string };
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not create watchlist");
      }
      const createdId = body.data?.id?.trim();
      if (createdId) {
        setSelectedWatchlistId(createdId);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create watchlist failed");
    } finally {
      setCreatingWatchlist(false);
    }
  }, [load, watchlistBaseUrl]);

  const enterEdit = useCallback(() => {
    editBaselineRef.current = {
      name: listName,
      rows: rows.map(cloneWatchlistRow)
    };
    setDraftName(listName);
    setDraftRows(rows.map(cloneWatchlistRow));
    setEditMode(true);
  }, [listName, rows]);

  const cancelEdit = useCallback(() => {
    setEditMode(false);
    editBaselineRef.current = null;
  }, []);

  const saveEdits = useCallback(async () => {
    const baseline = editBaselineRef.current;
    if (!baseline) {
      return;
    }
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      window.alert("Watchlist name cannot be empty.");
      return;
    }
    for (const d of draftRows) {
      if (d.rowStatus === "active" && !(d.rationale ?? "").trim()) {
        window.alert(`Add a rationale for ${d.symbol} before marking Active.`);
        return;
      }
    }
    setMutating(true);
    setError(null);
    try {
      const nameChanged = trimmed !== baseline.name.trim();
      const removed = baseline.rows
        .filter((b) => !draftRows.some((d) => d.symbol === b.symbol))
        .map((b) => b.symbol);
      const addEntries = buildDirtyAddEntries(baseline.rows, draftRows);
      if (!nameChanged && removed.length === 0 && addEntries.length === 0) {
        setEditMode(false);
        editBaselineRef.current = null;
        return;
      }
      let nameSent = false;
      const takeNamePayload = (): Record<string, unknown> => {
        if (!nameChanged || nameSent) {
          return {};
        }
        nameSent = true;
        return { name: trimmed };
      };
      for (const batch of chunkSymbols(removed, MAX_WATCHLIST_SYMBOLS_PER_PATCH)) {
        await executePatch({ removeSymbols: batch, ...takeNamePayload() });
      }
      for (const batch of chunkSymbols(addEntries, MAX_WATCHLIST_SYMBOLS_PER_PATCH)) {
        await executePatch({ addEntries: batch, ...takeNamePayload() });
      }
      if (nameChanged && !nameSent) {
        await executePatch({ name: trimmed });
      }
      onWatchlistMutated?.();
      setEditMode(false);
      editBaselineRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setMutating(false);
      setRemovingSymbol(null);
    }
  }, [draftName, draftRows, executePatch, onWatchlistMutated]);

  const updateDraftRow = useCallback(
    (
      symbol: string,
      partial: Partial<
        Pick<
        WatchlistRow,
        "lineType" | "strategy" | "quantity" | "entryPrice" | "rationale" | "rowStatus"
      >
      >
    ) => {
      setDraftRows((prev) =>
        prev.map((r) => (r.symbol === symbol ? { ...r, ...partial } : r))
      );
    },
    []
  );

  const onRemoveSymbol = useCallback(
    async (symbol: string) => {
      if (editMode) {
        setDraftRows((prev) => prev.filter((r) => r.symbol !== symbol));
        return;
      }
      setRemovingSymbol(symbol);
      await patch({ removeSymbols: [symbol] });
    },
    [editMode, patch]
  );

  const onDedupe = useCallback(async () => {
    if (editMode) {
      return;
    }
    await patch({ dedupe: true });
  }, [editMode, patch]);

  const onAdd = useCallback(async () => {
    if (editMode) {
      return;
    }
    const raw = window.prompt("Add ticker (e.g. TSLA, AAPL):");
    if (raw == null) {
      return;
    }
    const symbol = raw.trim().toUpperCase();
    if (!symbol || !/^[A-Z0-9.\-]{1,32}$/.test(symbol)) {
      window.alert("Invalid symbol.");
      return;
    }
    await patch({ addSymbols: [symbol] });
  }, [editMode, patch]);

  const onExport = useCallback(() => {
    if (rows.length === 0) {
      return;
    }
    const sorted = applyWatchlistSort(rows, sort.column, sort.dir);
    const blob = new Blob([toCsv(sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atxfinance-watchlist-${listName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [listName, rows, sort.column, sort.dir]);

  const onPickImportFile = useCallback(() => {
    importFileRef.current?.click();
  }, []);

  const onImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (editMode) {
        event.target.value = "";
        return;
      }
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      let text: string;
      try {
        text = await file.text();
      } catch {
        window.alert("Could not read that file.");
        return;
      }
      const { entries, invalidRowCount } = parseWatchlistCsv(text);
      if (entries.length === 0) {
        window.alert("No valid tickers found. Use a column named Symbol (or put tickers in the first column).");
        return;
      }
      const currentSymbols = rows.map((r) => r.symbol);
      const { workload, skippedNewCount } = buildImportWorkload(entries, currentSymbols);
      if (workload.length === 0) {
        if (skippedNewCount > 0) {
          window.alert(
            `Watchlist is full (${MAX_WATCHLIST_SYMBOLS} symbols max). Remove some before adding new tickers from this file.`
          );
        } else {
          window.alert("Nothing to apply from this file.");
        }
        return;
      }
      setMutating(true);
      setError(null);
      try {
        for (const batch of chunkSymbols(workload, MAX_WATCHLIST_SYMBOLS_PER_PATCH)) {
          const res = await fetch(`${watchlistBaseUrl}?${watchlistFetchQuery}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ addEntries: batch })
          });
          const { json } = await readFetchJsonBody<{ data?: WatchlistApiData; error?: string }>(res);
          if (!res.ok) {
            throw new Error(
              json.error ??
                (res.status === 429
                  ? "Too many requests. Please wait a moment and retry."
                  : "Update failed")
            );
          }
          if (json.data) {
            startTransition(() => {
              setListName(json.data!.name ?? "Default");
              setRows(buildRows(json.data!));
            });
          }
        }
        const parts = [
          `Applied ${workload.length} row${workload.length === 1 ? "" : "s"} (Type, Strategy, Quantity; Entry Price/Entry when set, else Price, Last, or Close → stored entry price).`
        ];
        if (invalidRowCount > 0) {
          parts.push(`Skipped ${invalidRowCount} invalid row${invalidRowCount === 1 ? "" : "s"}.`);
        }
        if (skippedNewCount > 0) {
          parts.push(
            `${skippedNewCount} new ticker${skippedNewCount === 1 ? "" : "s"} not added (watchlist holds at most ${MAX_WATCHLIST_SYMBOLS} symbols).`
          );
        }
        window.alert(parts.join(" "));
        onWatchlistMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setMutating(false);
      }
    },
    [editMode, rows, watchlistBaseUrl, watchlistFetchQuery, startTransition, onWatchlistMutated]
  );

  const displayRows = editMode ? draftRows : rows;
  const topByVolume = useMemo(() => {
    return [...rows]
      .filter((r) => typeof r.quote?.volume === "number" && Number.isFinite(r.quote.volume))
      .sort((a, b) => (b.quote?.volume ?? 0) - (a.quote?.volume ?? 0))
      .slice(0, 3);
  }, [rows]);
  const topByMove = useMemo(() => {
    return [...rows]
      .filter((r) => typeof r.quote?.changePercent === "number" && Number.isFinite(r.quote.changePercent))
      .sort((a, b) => Math.abs(b.quote?.changePercent ?? 0) - Math.abs(a.quote?.changePercent ?? 0))
      .slice(0, 3);
  }, [rows]);
  const quotePanelRow = useMemo(() => {
    if (!quotePanelSymbol) {
      return null;
    }
    const symbolUpper = quotePanelSymbol.trim().toUpperCase();
    return rows.find((row) => row.symbol.trim().toUpperCase() === symbolUpper) ?? null;
  }, [quotePanelSymbol, rows]);
  const watchlistSummaryText = useMemo(() => {
    const holdingsLine = `${rows.length} holding${rows.length === 1 ? "" : "s"} tracked`;
    const volumeLine =
      topByVolume.length > 0
        ? `Top volume: ${topByVolume
            .map((r) => `${r.symbol} ${(r.quote?.volume ?? 0).toLocaleString()}`)
            .join(" · ")}`
        : "Top volume: —";
    const moveLine =
      topByMove.length > 0
        ? `Biggest changes: ${topByMove
            .map((r) => {
              const pct = r.quote?.changePercent ?? 0;
              const sign = pct > 0 ? "+" : "";
              return `${r.symbol} ${sign}${pct.toFixed(2)}%`;
            })
            .join(" · ")}`
        : "Biggest changes: —";
    return { holdingsLine, volumeLine, moveLine };
  }, [rows.length, topByMove, topByVolume]);
  const portfolioTotalUsd = useMemo(() => {
    const n = Number.parseFloat(portfolioTotalInput.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [portfolioTotalInput]);

  const sortedDisplayRows = useMemo(
    () => applyWatchlistSort(displayRows, sort.column, sort.dir),
    [displayRows, sort.column, sort.dir]
  );

  const filteredSortedRows = useMemo(() => {
    const q = symbolSearch.trim().toUpperCase();
    if (!q) {
      return sortedDisplayRows;
    }
    return sortedDisplayRows.filter((r) => r.symbol.toUpperCase().includes(q));
  }, [sortedDisplayRows, symbolSearch]);

  const metricRowsForExec: WatchlistMetricRow[] = useMemo(
    () =>
      displayRows.map((r) => ({
        symbol: r.symbol,
        targetEntryNotional: getTargetEntryNumeric(r),
        ivPercent: r.chainGlance?.impliedVolatilityPercent ?? null
      })),
    [displayRows]
  );
  const execMetrics = useMemo(() => computeExecutiveMetrics(metricRowsForExec), [metricRowsForExec]);

  const showRationaleBanner = useMemo(
    () => displayRows.length > 0 && displayRows.some((r) => !(r.rationale ?? "").trim()),
    [displayRows]
  );

  const watchlistVirtualize = !editMode && filteredSortedRows.length >= WATCHLIST_VIRTUAL_MIN_ROWS;
  const rowVirtualizer = useVirtualizer({
    count: filteredSortedRows.length,
    getScrollElement: () => tableScrollParentRef.current,
    estimateSize: () => WATCHLIST_VIRTUAL_ROW_ESTIMATE_PX,
    overscan: 8
  });
  const sidebarTitle = editMode ? draftName || listName : listName;

  return (
    <div className="xf-watchlist-app w-full max-w-full">
      <div className="xf-watchlist-layout w-full max-w-full">
        <aside
          className={`xf-watchlist-sidebar${listNavCollapsed ? " xf-watchlist-sidebar--collapsed" : ""}`}
          hidden={!showLocalSidebar}
        >
          <div className="xf-watchlist-sidebar-head">
            <h2
              className={`xf-watchlist-sidebar-title${listNavCollapsed ? " sr-only" : ""}`}
              id="watchlist-nav-heading"
            >
              Watchlists
            </h2>
            <button
              aria-controls="watchlist-nav-panel"
              aria-expanded={!listNavCollapsed}
              className="xf-watchlist-sidebar-toggle"
              type="button"
              onClick={toggleListNav}
            >
              <WatchlistSidebarChevron direction={listNavCollapsed ? "right" : "left"} />
              <span className="sr-only">
                {listNavCollapsed ? "Expand watchlist list" : "Collapse watchlist list"}
              </span>
            </button>
          </div>
          <div
            className="xf-watchlist-sidebar-panel"
            hidden={listNavCollapsed}
            id="watchlist-nav-panel"
          >
            <button className="xf-watchlist-new-btn" disabled type="button">
              <AddIcon className="crud-icon" />
              New watchlist
            </button>
            <div className="xf-watchlist-nav-item">
              {sidebarTitle}
              <small>{watchlistSummaryText.holdingsLine}</small>
              <small>{watchlistSummaryText.volumeLine}</small>
              <small>{watchlistSummaryText.moveLine}</small>
            </div>
          </div>
        </aside>

        <div className="xf-watchlist-main w-full max-w-full">
          <div className="xf-watchlist-card xf-noise-overlay w-full max-w-full">
            <header className="xf-watchlist-card-header">
              {editMode ? (
                <input
                  aria-label="Watchlist name"
                  className="xf-watchlist-name-input"
                  maxLength={128}
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              ) : (
                <h1 className="xf-watchlist-card-title">{listName}</h1>
              )}
              <p className="xf-watchlist-card-sub">
                {watchlistSummaryText.holdingsLine} · {watchlistSummaryText.volumeLine} ·{" "}
                {watchlistSummaryText.moveLine}
              </p>
            </header>

            {!loading && rows.length > 0 ? (
              <section aria-label="Executive summary" className="xf-watchlist-exec">
                <div className="xf-watchlist-exec__grid">
                  <div className="xf-watchlist-exec__card">
                    <span className="xf-watchlist-exec__label">Total legs</span>
                    <span className="xf-watchlist-exec__value">{execMetrics.legCount}</span>
                  </div>
                  <div className="xf-watchlist-exec__card">
                    <span className="xf-watchlist-exec__label">Weighted avg IV</span>
                    <span className="xf-watchlist-exec__value">
                      {execMetrics.weightedAvgIv != null ? `${execMetrics.weightedAvgIv.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div
                    className={`xf-watchlist-exec__card${execMetrics.concentrationTopPct > 40 ? " xf-watchlist-exec__card--warn" : ""}`}
                  >
                    <span className="xf-watchlist-exec__label">Sector concentration</span>
                    <span className="xf-watchlist-exec__value">{execMetrics.concentrationSummary}</span>
                    {execMetrics.concentrationTopPct > 40 ? (
                      <span className="xf-watchlist-exec__badge">High</span>
                    ) : null}
                  </div>
                  <div className="xf-watchlist-exec__card">
                    <span className="xf-watchlist-exec__label">Est. capital at risk (target entries)</span>
                    <span className="xf-watchlist-exec__value">{execMetrics.capitalAtRiskDisplay}</span>
                  </div>
                </div>
                {execMetrics.hasIvData && execMetrics.highIvAllOver150 ? (
                  <p className="xf-watchlist-exec__warn">
                    High-IV warning: all legs &gt;150% IV — premium-selling territory, not buying.
                  </p>
                ) : null}
              </section>
            ) : null}

            {showRationaleBanner ? (
              <div className="xf-watchlist-rationale-banner" role="status">
                Add rationale + target % risk before execution — prevents emotional sizing.
              </div>
            ) : null}

            <input
              ref={importFileRef}
              accept=".csv,text/csv"
              aria-hidden
              className="xf-watchlist-import-input"
              style={{ display: "none" }}
              tabIndex={-1}
              type="file"
              onChange={(e) => void onImportFileChange(e)}
            />
            <div className="xf-watchlist-toolbar xf-watchlist-toolbar--wrap">
              <label className="xf-watchlist-list-picker">
                <span className="xf-watchlist-list-picker__label">Watchlist</span>
                <select
                  aria-label="Select watchlist"
                  className="xf-watchlist-list-picker__select"
                  disabled={mutating || creatingWatchlist || editMode || availableWatchlists.length === 0}
                  value={selectedWatchlistId}
                  onChange={(event) => setSelectedWatchlistId(event.target.value)}
                >
                  {availableWatchlists.length === 0 ? <option value="">Default</option> : null}
                  {availableWatchlists.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.symbolCount})
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="xf-watchlist-toolbar-btn"
                disabled={mutating || creatingWatchlist || editMode}
                type="button"
                onClick={() => void onCreateWatchlist()}
              >
                <AddIcon className="crud-icon" />
                New watchlist
              </button>
              <label className="xf-watchlist-portfolio-total">
                <span className="xf-watchlist-portfolio-total__label">Portfolio total ($)</span>
                <input
                  aria-label="Portfolio total USD for percent risk column"
                  className="xf-watchlist-portfolio-total__input"
                  inputMode="decimal"
                  placeholder="e.g. 2500000"
                  type="text"
                  value={portfolioTotalInput}
                  onBlur={() => onPortfolioTotalBlur()}
                  onChange={(e) => setPortfolioTotalInput(e.target.value)}
                />
              </label>
              {!editMode ? (
                <IconEditButton
                  disabled={loading}
                  label="Edit watchlist"
                  variant="watchlist-toolbar"
                  onClick={enterEdit}
                />
              ) : (
                <>
                  <button
                    className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--primary"
                    disabled={mutating}
                    type="button"
                    onClick={() => void saveEdits()}
                  >
                    <SaveIcon className="crud-icon" />
                    Save changes
                  </button>
                  <button
                    className="xf-watchlist-toolbar-btn"
                    disabled={mutating}
                    type="button"
                    onClick={cancelEdit}
                  >
                    <XMarkIcon className="crud-icon" />
                    Cancel
                  </button>
                </>
              )}
              <Link
                className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-link"
                href={`/portfolio?portfolioId=${encodeURIComponent(portfolioId)}`}
              >
                <UnlinkIcon className="crud-icon" />
                Portfolio / holdings
              </Link>
              <button
                className="xf-watchlist-toolbar-btn"
                title="Reminder: short-premium legs create ordinary income vs. long-term capital gains in many jurisdictions. Consult a tax advisor."
                type="button"
                onClick={() =>
                  window.alert(
                    "Tax note (educational): short-premium options income is often taxed as ordinary income; long holdings may qualify for long-term capital gains. This is not tax advice — consult a CPA."
                  )
                }
              >
                Generate tax note
              </button>
              <button
                className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--accent"
                disabled={rows.length === 0}
                type="button"
                onClick={onExportAdvisorPdf}
              >
                Export for Advisor
              </button>
              <button
                className="xf-watchlist-toolbar-btn"
                disabled={rows.length === 0 || loading || editMode}
                type="button"
                onClick={onExport}
              >
                <DownloadIcon className="crud-icon" />
                Export CSV
              </button>
              <button
                aria-label="Import watchlist from a CSV file"
                className="xf-watchlist-toolbar-btn"
                disabled={mutating || loading || editMode}
                type="button"
                onClick={onPickImportFile}
              >
                <UploadIcon className="crud-icon" />
                Import CSV
              </button>
              <button
                className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--warn"
                disabled={mutating || loading || editMode}
                type="button"
                onClick={() => void onDedupe()}
              >
                <DedupeIcon className="crud-icon" />
                Remove duplicates
              </button>
              <button
                className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--primary"
                disabled={mutating || loading || editMode}
                type="button"
                onClick={() => void onAdd()}
              >
                <AddIcon className="crud-icon" />
                Add
              </button>
            </div>

            {error ? (
              <p className="xf-watchlist-status xf-watchlist-status--err" role="alert">
                {error}
              </p>
            ) : null}
            {loading ? (
              <p className="xf-watchlist-status">Loading watchlist…</p>
            ) : null}

            {!loading && rows.length === 0 ? (
              <p className="xf-watchlist-empty">
                No symbols yet. Use + Add, Import CSV (e.g. <code>atxfinance-watchlist.csv</code>), or open xChat to
                seed defaults.
              </p>
            ) : null}

            {!loading && rows.length > 0 && filteredSortedRows.length === 0 ? (
              <p className="xf-watchlist-status">No symbols match your filter.</p>
            ) : null}

            {!loading && rows.length > 0 ? (
              <div
                ref={tableScrollParentRef}
                className={`xf-watchlist-table-wrap w-full max-w-full overflow-x-auto${watchlistVirtualize ? " xf-watchlist-table-wrap--virtual" : ""}`}
              >
                <table className={`xf-watchlist-table w-full max-w-full${watchlistVirtualize ? " xf-watchlist-table--virtual" : ""}`}>
                  <thead>
                    <tr>
                      <th scope="col">Icon</th>
                      <th
                        aria-sort={
                          sort.column === "instrument"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("instrument")}
                        >
                          SYMBOL
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "instrument" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th scope="col">Spot</th>
                      <th
                        aria-sort={
                          sort.column === "iv"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("iv")}
                        >
                          IV
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "iv" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sort.column === "ivRank"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("ivRank")}
                        >
                          IV Rank
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "ivRank" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sort.column === "optionsVolume"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("optionsVolume")}
                        >
                          Opt Vol
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "optionsVolume" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sort.column === "oi"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("oi")}
                        >
                          OI
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "oi" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th scope="col">Leg</th>
                      <th scope="col">Catalyst</th>
                      <th scope="col">RSI(14)</th>
                      <th
                        aria-sort={
                          sort.column === "targetEntry"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("targetEntry")}
                        >
                          Target entry
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "targetEntry" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th scope="col">% book risk</th>
                      <th
                        aria-sort={
                          sort.column === "distToTarget"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("distToTarget")}
                        >
                          Dist target
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "distToTarget" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th
                        aria-sort={
                          sort.column === "quickScore"
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        scope="col"
                      >
                        <button
                          className="xf-watchlist-sort-btn"
                          type="button"
                          onClick={() => toggleWatchlistSort("quickScore")}
                        >
                          Quick score
                          <span aria-hidden className="xf-watchlist-sort-indicator">
                            {sort.column === "quickScore" ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                          </span>
                        </button>
                      </th>
                      <th scope="col">Rationale</th>
                      <th scope="col">Status</th>
                      <th scope="col">Last update</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  {watchlistVirtualize ? (
                    <tbody
                      style={{
                        display: "block",
                        height: rowVirtualizer.getTotalSize(),
                        position: "relative",
                        width: "100%"
                      }}
                    >
                      {rowVirtualizer.getVirtualItems().map((vr) => {
                        const row = filteredSortedRows[vr.index]!;
                        return (
                          <WatchlistRowTr
                            key={`wl-${vr.index}-${row.addedAt}-${row.symbol}`}
                            aiSuggestBusy={aiSuggestSymbol === row.symbol}
                            editMode={editMode}
                            listLoadedAtLabel={listLoadedAtLabel}
                            mutating={mutating}
                            patchRowMeta={patchRowMeta}
                            patchRowEntryPrice={patchRowEntryPrice}
                            portfolioTotalUsd={portfolioTotalUsd}
                            removingThisSymbol={removingSymbol === row.symbol}
                            row={row}
                            rowClassName="xf-watchlist-table__data-row"
                            rowStyle={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              display: "grid",
                              height: `${vr.size}px`,
                              transform: `translateY(${vr.start}px)`
                            }}
                            updateDraftRow={updateDraftRow}
                            onAiSuggest={onAiSuggestRow}
                            onShowQuote={(r) => setQuotePanelSymbol(r.symbol)}
                            onRemoveSymbol={onRemoveSymbol}
                          />
                        );
                      })}
                    </tbody>
                  ) : (
                    <tbody>
                      {filteredSortedRows.map((row, rowIndex) => {
                        return (
                          <WatchlistRowTr
                            key={`wl-${rowIndex}-${row.addedAt}-${row.symbol}`}
                            aiSuggestBusy={aiSuggestSymbol === row.symbol}
                            editMode={editMode}
                            listLoadedAtLabel={listLoadedAtLabel}
                            mutating={mutating}
                            patchRowMeta={patchRowMeta}
                            patchRowEntryPrice={patchRowEntryPrice}
                            portfolioTotalUsd={portfolioTotalUsd}
                            removingThisSymbol={removingSymbol === row.symbol}
                            row={row}
                            updateDraftRow={updateDraftRow}
                            onAiSuggest={onAiSuggestRow}
                            onShowQuote={(r) => setQuotePanelSymbol(r.symbol)}
                            onRemoveSymbol={onRemoveSymbol}
                          />
                        );
                      })}
                    </tbody>
                  )}
                </table>
              </div>
            ) : null}
          </div>

          {quotePanelRow ? (
            <div className="xf-watchlist-quote-panel-backdrop" role="presentation" onClick={() => setQuotePanelSymbol(null)}>
              <aside
                aria-label={`${quotePanelRow.symbol} quote details`}
                aria-modal="true"
                className="xf-watchlist-quote-panel"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="xf-watchlist-quote-panel__head">
                  <h3 className="xf-watchlist-quote-panel__title">
                    {quotePanelRow.symbol} quote
                  </h3>
                  <button
                    aria-label="Close quote details"
                    className="xf-watchlist-quote-panel__close"
                    type="button"
                    onClick={() => setQuotePanelSymbol(null)}
                  >
                    <XMarkIcon className="crud-icon" />
                  </button>
                </div>
                <p className="xf-watchlist-quote-panel__asof">
                  As of {listLoadedAtLabel || "latest refresh"}
                </p>
                <dl className="xf-watchlist-quote-panel__grid">
                  <div>
                    <dt>Quote</dt>
                    <dd>{formatSpotCell(quotePanelRow)}</dd>
                  </div>
                  <div>
                    <dt>Change</dt>
                    <dd>
                      {typeof quotePanelRow.quote?.change === "number" &&
                      Number.isFinite(quotePanelRow.quote.change) &&
                      typeof quotePanelRow.quote?.changePercent === "number" &&
                      Number.isFinite(quotePanelRow.quote.changePercent)
                        ? `${quotePanelRow.quote.change > 0 ? "+" : ""}${quotePanelRow.quote.change.toFixed(2)} (${quotePanelRow.quote.changePercent > 0 ? "+" : ""}${quotePanelRow.quote.changePercent.toFixed(2)}%)`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Volume</dt>
                    <dd>
                      {typeof quotePanelRow.quote?.volume === "number" && Number.isFinite(quotePanelRow.quote.volume)
                        ? quotePanelRow.quote.volume.toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Day range</dt>
                    <dd>
                      {typeof quotePanelRow.quote?.low === "number" &&
                      Number.isFinite(quotePanelRow.quote.low) &&
                      typeof quotePanelRow.quote?.high === "number" &&
                      Number.isFinite(quotePanelRow.quote.high)
                        ? `${formatUsd2(quotePanelRow.quote.low)} - ${formatUsd2(quotePanelRow.quote.high)}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>52 week range</dt>
                    <dd>
                      {typeof quotePanelRow.quote?.fiftyTwoWeekLow === "number" &&
                      Number.isFinite(quotePanelRow.quote.fiftyTwoWeekLow) &&
                      typeof quotePanelRow.quote?.fiftyTwoWeekHigh === "number" &&
                      Number.isFinite(quotePanelRow.quote.fiftyTwoWeekHigh)
                        ? `${formatUsd2(quotePanelRow.quote.fiftyTwoWeekLow)} - ${formatUsd2(quotePanelRow.quote.fiftyTwoWeekHigh)}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Company</dt>
                    <dd>{quotePanelRow.quote?.companyName?.trim() || quotePanelRow.symbol}</dd>
                  </div>
                </dl>
                <p className="xf-watchlist-quote-panel__foot">
                  Data source: Yahoo Finance.
                </p>
              </aside>
            </div>
          ) : null}

          {symbolSearchOpen ? (
            <div
              className="xf-watchlist-search-overlay"
              role="dialog"
              aria-label="Symbol filter"
              onClick={() => setSymbolSearchOpen(false)}
            >
              <div className="xf-watchlist-search-panel" onClick={(e) => e.stopPropagation()}>
                <p className="xf-watchlist-search-title">Filter symbols</p>
                <input
                  aria-label="Filter watchlist by symbol"
                  autoFocus
                  className="xf-watchlist-search-input"
                  placeholder="Type ticker…"
                  type="search"
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                />
                <button className="xf-watchlist-search-close" type="button" onClick={() => setSymbolSearchOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          ) : null}

          {variant === "page" ? (
            <div className="cta-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              {footerMode === "admin" ? (
                <>
                  <Link className="cta cta-secondary" href="/admin/portfolios">
                    <BackIcon className="crud-icon" />
                    Portfolios
                  </Link>
                  <Link
                    className="cta cta-secondary"
                    href={`/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`}
                  >
                    <EditIcon className="crud-icon" />
                    Manage accounts
                  </Link>
                </>
              ) : (
                <>
                  <Link className="cta cta-secondary" href="/portfolio">
                    <BackIcon className="crud-icon" />
                    Back to portfolio
                  </Link>
                  {isAdmin ? (
                    <Link className="cta cta-primary" href="/admin/portfolios">
                      <ExternalLinkIcon className="crud-icon" />
                      Open in Hub
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
