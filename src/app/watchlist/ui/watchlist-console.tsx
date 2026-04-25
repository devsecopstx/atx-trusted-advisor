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

type WatchlistChainGlance = {
  contractType: "call" | "put";
  strike: number;
  impliedVolatilityPercent: number;
  openInterest: number;
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
};

type WatchlistApiData = {
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

type WatchlistSortColumn = "instrument" | "targetEntry" | "iv" | "oi";

/** Whole-dollar notional: round(100× live quote) for sort and display. */
function getTargetEntryNumeric(row: WatchlistRow): number | null {
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
    if (sortColumn === "oi") {
      return compareNumericColumn(mult, getOiSortValue(a), getOiSortValue(b), a, b);
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

function ivBadgeParts(row: WatchlistRow): { label: string; pct: number | null } {
  const iv = row.chainGlance?.impliedVolatilityPercent;
  if (iv == null || !Number.isFinite(iv)) {
    return { label: "—", pct: null };
  }
  const pct = heuristicIvPercentile(iv);
  return { label: `${iv.toFixed(1)}% (${pct}th)`, pct };
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
  enableAddToHoldings?: boolean;
  symbolInPortfolioStocks?: boolean;
  addHoldingsBusy?: boolean;
  onAddToHoldings?: (row: WatchlistRow) => void;
  portfolioTotalUsd: number;
  listLoadedAtLabel: string;
  portfolioId: string;
  patchRowMeta: (symbol: string, partial: { rationale?: string; rowStatus?: WatchlistRowStatus }) => Promise<void>;
  aiSuggestBusy: boolean;
  onAiSuggest: (row: WatchlistRow) => void;
  onExportLeg: (row: WatchlistRow) => void;
  onOpenAnalyze: (row: WatchlistRow) => void;
  onOpenFlipCredit: (row: WatchlistRow) => void;
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
  enableAddToHoldings = false,
  symbolInPortfolioStocks = false,
  addHoldingsBusy = false,
  onAddToHoldings,
  portfolioTotalUsd,
  listLoadedAtLabel,
  portfolioId,
  patchRowMeta,
  aiSuggestBusy,
  onAiSuggest,
  onExportLeg,
  onOpenAnalyze,
  onOpenFlipCredit
}: WatchlistRowTrProps) {
  const ivParts = ivBadgeParts(row);
  const te = getTargetEntryNumeric(row);
  const riskPct = formatPortfolioRiskPct(te, portfolioTotalUsd);
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

  const closeRationaleDialog = useCallback(() => {
    setRationaleDialogOpen(false);
    setRationaleDialogEditing(false);
    setRationaleDraft(row.rationale ?? "");
  }, [row.rationale]);

  const saveRationaleDialog = useCallback(async () => {
    const prev = (row.rationale ?? "").trim();
    const next = rationaleDraft.trim();
    if (prev !== next) {
      await patchRowMeta(row.symbol, { rationale: next });
    }
    setRationaleDialogOpen(false);
  }, [patchRowMeta, rationaleDraft, row.rationale, row.symbol]);

  return (
    <tr className={rowClassName} style={rowStyle}>
      <td className="xf-watchlist-table-icon-cell">
        <WatchlistIconBadge logoUrl={row.quote?.logoUrl} symbol={row.symbol} />
      </td>
      <td>
        <div className="xf-watchlist-sym-cell">
          <div className="xf-watchlist-sym-cell__row">
            <span className="xf-watchlist-sym-cell__label">{row.symbol}</span>
            {symbolInPortfolioStocks ? (
              <span className="xf-watchlist-in-book" title="Held in this portfolio book">
                ✓
              </span>
            ) : null}
            <a
              className="xf-watchlist-sym-cell__ext"
              href={`https://finance.yahoo.com/quote/${encodeURIComponent(row.symbol)}`}
              rel="noreferrer"
              target="_blank"
              title={`${row.symbol} on Yahoo Finance`}
            >
              <ExternalLinkIcon className="crud-icon" aria-hidden />
              <span className="sr-only">Yahoo Finance ({row.symbol})</span>
            </a>
          </div>
          {companyBlurb ? (
            <div className="xf-watchlist-sym-cell__company" title={companyFull}>
              {companyBlurb}
            </div>
          ) : null}
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
          {ivParts.pct != null && ivParts.pct >= 94 ? (
            <span className="xf-watchlist-iv-rank" title="Heuristic IV rank">
              🟥
            </span>
          ) : null}
          <span>{ivParts.label}</span>
        </span>
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">
        {row.chainGlance != null ? formatOiCell(row.chainGlance.openInterest) : "—"}
      </td>
      <td className="xf-watchlist-table-mono xf-watchlist-table-nowrap">{formatLegCell(row)}</td>
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
        <details className="xf-watchlist-row-actions-dd">
          <summary className="xf-watchlist-row-actions-summary">Menu</summary>
          <div className="xf-watchlist-row-actions-panel">
            <button type="button" onClick={() => onOpenAnalyze(row)}>
              Analyze (P/L)
            </button>
            <button type="button" onClick={() => onOpenFlipCredit(row)}>
              Flip to Credit
            </button>
            {enableAddToHoldings ? (
              <button
                disabled={editMode || symbolInPortfolioStocks || addHoldingsBusy || mutating}
                type="button"
                onClick={() => onAddToHoldings?.(row)}
              >
                Add to Portfolio
              </button>
            ) : (
              <Link className="xf-watchlist-dd-link" href={`/portfolio?portfolioId=${encodeURIComponent(portfolioId)}`}>
                Add to Portfolio
              </Link>
            )}
            <button type="button" onClick={() => onExportLeg(row)}>
              Export leg CSV
            </button>
            <button
              className="xf-watchlist-dd-danger"
              disabled={(mutating && !editMode) || removingThisSymbol}
              type="button"
              onClick={() => void onRemoveSymbol(row.symbol)}
            >
              Delete
            </button>
          </div>
        </details>
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
const XOPTIONS_LAST_SYMBOL_LS_KEY = "xf_portfolios_last_xoptions_symbol_v1";

function stripMarkdownishFirstLine(raw: string): string {
  const t = raw.trim().replace(/^#+\s*/m, "").split(/\n/)[0]?.trim() ?? "";
  return t.slice(0, 280);
}

function oneRowToCsv(row: WatchlistRow): string {
  const headers = [
    "Symbol",
    "Spot",
    "IV%",
    "OI",
    "Leg",
    "TargetEntry100x",
    "Rationale",
    "RowStatus"
  ];
  const iv = row.chainGlance?.impliedVolatilityPercent;
  const line = [
    row.symbol,
    row.quote?.price ?? "",
    iv ?? "",
    row.chainGlance?.openInterest ?? "",
    row.chainGlance ? `${row.chainGlance.contractType} ${row.chainGlance.strike}` : "",
    getTargetEntryNumeric(row) ?? "",
    (row.rationale ?? "").replaceAll('"', '""'),
    row.rowStatus ?? "draft"
  ].join(",");
  return `${headers.join(",")}\n${line}`;
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
  /** Fired after a stock is added via “Add to holdings” (parent usually `router.refresh()`). */
  onBookMutated?: () => void;
};

export function WatchlistConsole({
  portfolioId,
  isAdmin,
  watchlistApiPrefix = "/api/portfolios",
  footerMode = "app_user",
  variant = "page",
  addToHoldingsAccountIdHex = null,
  portfolioStockSymbolsUpper = [],
  onWatchlistMutated,
  onBookMutated
}: WatchlistConsoleProps) {
  const watchlistBaseUrl = `${watchlistApiPrefix}/${encodeURIComponent(portfolioId)}/watchlist`;
  const watchlistFetchQuery = "quotes=1&chainGlance=1";
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
  const [addingHoldingsSymbol, setAddingHoldingsSymbol] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [listNavCollapsed, setListNavCollapsed] = useState(true);
  const [portfolioTotalInput, setPortfolioTotalInput] = useState("");
  const [listLoadedAtLabel, setListLoadedAtLabel] = useState("");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false);
  const [aiSuggestSymbol, setAiSuggestSymbol] = useState<string | null>(null);
  const [sort, setSort] = useState<{ column: WatchlistSortColumn; dir: "asc" | "desc" }>({
    column: "instrument",
    dir: "asc"
  });
  const [, startTransition] = useTransition();
  const tableScrollParentRef = useRef<HTMLDivElement>(null);

  const portfolioStockSet = useMemo(
    () =>
      new Set(
        portfolioStockSymbolsUpper.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0)
      ),
    [portfolioStockSymbolsUpper]
  );
  const enableAddToHoldingsUi =
    variant === "embedded" && Boolean(addToHoldingsAccountIdHex?.trim());

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
        setListLoadedAtLabel(new Date().toLocaleString());
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [watchlistBaseUrl, watchlistFetchQuery, startTransition]);

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

  const onExportLeg = useCallback((row: WatchlistRow) => {
    const blob = new Blob([oneRowToCsv(row)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atxfinance-leg-${row.symbol.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const pushXoptionsSymbol = useCallback((sym: string) => {
    try {
      sessionStorage.setItem(XOPTIONS_LAST_SYMBOL_LS_KEY, sym.trim().toUpperCase());
    } catch {
      /* ignore */
    }
  }, []);

  const onOpenAnalyze = useCallback(
    (row: WatchlistRow) => {
      pushXoptionsSymbol(row.symbol);
      window.location.href = "/xoptions";
    },
    [pushXoptionsSymbol]
  );

  const onOpenFlipCredit = useCallback(
    (row: WatchlistRow) => {
      pushXoptionsSymbol(row.symbol);
      window.location.href = "/xoptions";
    },
    [pushXoptionsSymbol]
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

  const addSymbolToHoldings = useCallback(
    async (row: WatchlistRow) => {
      const accountId = addToHoldingsAccountIdHex?.trim();
      if (!accountId) {
        return;
      }
      const symbol = row.symbol.trim().toUpperCase();
      if (!symbol) {
        return;
      }
      let qty = 1;
      if (row.quantity !== undefined && Number.isFinite(row.quantity) && row.quantity > 0) {
        qty = row.quantity;
      }
      let avgCost: number | undefined;
      if (row.entryPrice !== undefined && Number.isFinite(row.entryPrice) && row.entryPrice >= 0) {
        avgCost = row.entryPrice;
      } else if (row.quote?.price != null && Number.isFinite(row.quote.price) && row.quote.price >= 0) {
        avgCost = row.quote.price;
      }
      if (avgCost === undefined) {
        const raw = window.prompt(`Average cost per share for ${symbol} (USD):`);
        if (raw == null) {
          return;
        }
        const n = Number.parseFloat(raw.trim());
        if (!Number.isFinite(n) || n < 0) {
          window.alert("Enter a non-negative number for average cost.");
          return;
        }
        avgCost = n;
      }
      setAddingHoldingsSymbol(symbol);
      setError(null);
      try {
        const res = await fetch("/api/positions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portfolioId,
            accountId,
            symbol,
            qty,
            avgCost,
            type: "stock"
          })
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? "Could not add holding");
        }
        onBookMutated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Add to holdings failed");
      } finally {
        setAddingHoldingsSymbol(null);
      }
    },
    [addToHoldingsAccountIdHex, onBookMutated, portfolioId]
  );

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
    <div className="xf-watchlist-app">
      <div className="xf-watchlist-layout">
        <aside
          className={`xf-watchlist-sidebar${listNavCollapsed ? " xf-watchlist-sidebar--collapsed" : ""}`}
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
              <small>General watchlist for tracking positions and opportunities.</small>
            </div>
          </div>
        </aside>

        <div className="xf-watchlist-main">
          <div className="xf-watchlist-card xf-noise-overlay">
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
                Quotes load from Yahoo Finance. Target entry uses 100× spot (desk quantity/entry in edit mode). Set a
                portfolio total for % risk (stored locally). <kbd className="xf-watchlist-kbd">⌘K</kbd> filters
                symbols.
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
              <button className="xf-watchlist-toolbar-btn xf-watchlist-toolbar-btn--danger" disabled type="button">
                <DeleteIcon className="crud-icon" />
                Delete
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
                className={`xf-watchlist-table-wrap${watchlistVirtualize ? " xf-watchlist-table-wrap--virtual" : ""}`}
              >
                <table className={`xf-watchlist-table${watchlistVirtualize ? " xf-watchlist-table--virtual" : ""}`}>
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
                          Sym
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
                        const symU = row.symbol.trim().toUpperCase();
                        return (
                          <WatchlistRowTr
                            key={`wl-${vr.index}-${row.addedAt}-${row.symbol}`}
                            addHoldingsBusy={addingHoldingsSymbol === symU}
                            aiSuggestBusy={aiSuggestSymbol === row.symbol}
                            editMode={editMode}
                            enableAddToHoldings={enableAddToHoldingsUi}
                            listLoadedAtLabel={listLoadedAtLabel}
                            mutating={mutating}
                            patchRowMeta={patchRowMeta}
                            portfolioId={portfolioId}
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
                            symbolInPortfolioStocks={portfolioStockSet.has(symU)}
                            updateDraftRow={updateDraftRow}
                            onAddToHoldings={(r) => void addSymbolToHoldings(r)}
                            onAiSuggest={onAiSuggestRow}
                            onExportLeg={onExportLeg}
                            onOpenAnalyze={onOpenAnalyze}
                            onOpenFlipCredit={onOpenFlipCredit}
                            onRemoveSymbol={onRemoveSymbol}
                          />
                        );
                      })}
                    </tbody>
                  ) : (
                    <tbody>
                      {filteredSortedRows.map((row, rowIndex) => {
                        const symU = row.symbol.trim().toUpperCase();
                        return (
                          <WatchlistRowTr
                            key={`wl-${rowIndex}-${row.addedAt}-${row.symbol}`}
                            addHoldingsBusy={addingHoldingsSymbol === symU}
                            aiSuggestBusy={aiSuggestSymbol === row.symbol}
                            editMode={editMode}
                            enableAddToHoldings={enableAddToHoldingsUi}
                            listLoadedAtLabel={listLoadedAtLabel}
                            mutating={mutating}
                            patchRowMeta={patchRowMeta}
                            portfolioId={portfolioId}
                            portfolioTotalUsd={portfolioTotalUsd}
                            removingThisSymbol={removingSymbol === row.symbol}
                            row={row}
                            symbolInPortfolioStocks={portfolioStockSet.has(symU)}
                            updateDraftRow={updateDraftRow}
                            onAddToHoldings={(r) => void addSymbolToHoldings(r)}
                            onAiSuggest={onAiSuggestRow}
                            onExportLeg={onExportLeg}
                            onOpenAnalyze={onOpenAnalyze}
                            onOpenFlipCredit={onOpenFlipCredit}
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
