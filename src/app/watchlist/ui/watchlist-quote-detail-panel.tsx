"use client";

import { useState } from "react";

import { XMarkIcon } from "@/app/admin/ui/crud-icons";
import { SymbolOhlcChartPanel } from "@/app/ui/symbol-ohlc-chart-panel";
import {
    formatPortfolioRiskPct,
    targetEntryRiskPctNumeric,
    targetEntryRiskPctToneClass
} from "@/app/watchlist/ui/watchlist-metrics";
import type { WatchlistRowStatus } from "@/modules/core-admin/types";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

export type WatchlistQuotePanelTab = "quote" | "rationale";

export type WatchlistQuotePanelRow = {
  symbol: string;
  rationale?: string;
  rowStatus?: WatchlistRowStatus;
  entryPrice?: number;
  quote: SymbolLookupResult | null;
};

type WatchlistQuoteDetailPanelProps = {
  row: WatchlistQuotePanelRow;
  activeTab: WatchlistQuotePanelTab;
  onTabChange: (tab: WatchlistQuotePanelTab) => void;
  onClose: () => void;
  listLoadedAtLabel: string;
  portfolioTotalUsd: number;
  editMode: boolean;
  mutating: boolean;
  aiSuggestBusy: boolean;
  updateDraftRow: (
    symbol: string,
    partial: Partial<Pick<WatchlistQuotePanelRow, "rationale" | "rowStatus">>
  ) => void;
  patchRowMeta: (symbol: string, partial: { rationale?: string; rowStatus?: WatchlistRowStatus }) => Promise<void>;
  onAiSuggest: (row: WatchlistQuotePanelRow) => void;
};

function rowStatusFromSelectValue(v: string): WatchlistRowStatus {
  if (v === "active" || v === "review") {
    return v;
  }
  return "draft";
}

function getTargetEntryNumeric(row: WatchlistQuotePanelRow): number | null {
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

function formatUsd2(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSpotCell(row: WatchlistQuotePanelRow): string {
  const px = row.quote?.price;
  if (px == null || !Number.isFinite(px)) {
    return "—";
  }
  return `$${formatUsd2(px)}`;
}

function WatchlistQuotePanelDeskMeta({
  row,
  portfolioTotalUsd,
  editMode,
  mutating,
  updateDraftRow,
  patchRowMeta,
  onTabChange
}: Pick<
  WatchlistQuoteDetailPanelProps,
  "row" | "portfolioTotalUsd" | "editMode" | "mutating" | "updateDraftRow" | "patchRowMeta" | "onTabChange"
>) {
  const targetNotional = getTargetEntryNumeric(row);
  const riskNum = targetEntryRiskPctNumeric(targetNotional, portfolioTotalUsd);
  const riskPct = formatPortfolioRiskPct(targetNotional, portfolioTotalUsd);

  const handleStatusChange = (next: WatchlistRowStatus) => {
    const rationale = (row.rationale ?? "").trim();
    if (next === "active" && rationale.length === 0) {
      window.alert(
        "Add a rationale before marking this row Active. Open the Rationale tab in this panel to add one."
      );
      onTabChange("rationale");
      return;
    }
    if (editMode) {
      updateDraftRow(row.symbol, { rowStatus: next });
      return;
    }
    void patchRowMeta(row.symbol, { rowStatus: next, rationale: row.rationale });
  };

  return (
    <dl className="xf-watchlist-quote-panel__desk-meta">
      <div>
        <dt>Status</dt>
        <dd>
          <select
            aria-label={`${row.symbol} row status`}
            className="xf-watchlist-status-select xf-watchlist-quote-panel__status-select"
            disabled={!editMode && mutating}
            value={row.rowStatus ?? "draft"}
            onChange={(e) => {
              handleStatusChange(rowStatusFromSelectValue(e.target.value));
            }}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="review">Review</option>
          </select>
        </dd>
      </div>
      <div>
        <dt>% book risk</dt>
        <dd className={`xf-watchlist-table-mono ${targetEntryRiskPctToneClass(riskNum)}`}>{riskPct}</dd>
      </div>
    </dl>
  );
}

function WatchlistQuoteRationaleTab({
  row,
  editMode,
  mutating,
  aiSuggestBusy,
  updateDraftRow,
  patchRowMeta,
  onAiSuggest
}: Pick<
  WatchlistQuoteDetailPanelProps,
  "row" | "editMode" | "mutating" | "aiSuggestBusy" | "updateDraftRow" | "patchRowMeta" | "onAiSuggest"
>) {
  const [rationaleEditing, setRationaleEditing] = useState(false);
  const [rationaleDraft, setRationaleDraft] = useState(row.rationale ?? "");
  const rationaleHasValue = (row.rationale ?? "").trim().length > 0;

  const saveRationale = async () => {
    const prev = (row.rationale ?? "").trim();
    const next = rationaleDraft.trim();
    if (prev !== next) {
      await patchRowMeta(row.symbol, { rationale: next });
    }
    setRationaleEditing(false);
  };

  return (
    <div className="xf-watchlist-quote-panel__rationale">
      {editMode ? (
        <textarea
          aria-label={`${row.symbol} rationale`}
          className="xf-watchlist-rationale-input"
          placeholder="Thesis (required for Active)"
          rows={8}
          value={row.rationale ?? ""}
          onChange={(e) => updateDraftRow(row.symbol, { rationale: e.target.value })}
        />
      ) : rationaleEditing ? (
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
          {rationaleHasValue
            ? row.rationale
            : "No rationale set yet. Open Edit or use AI Suggest before marking Active."}
        </div>
      )}
      {!editMode ? (
        <div className="xf-watchlist-quote-panel__rationale-actions">
          {rationaleEditing ? (
            <>
              <button
                className="xf-watchlist-rationale-modal__btn xf-watchlist-rationale-modal__btn--secondary"
                type="button"
                onClick={() => {
                  setRationaleDraft(row.rationale ?? "");
                  setRationaleEditing(false);
                }}
              >
                Cancel
              </button>
              <button
                className="xf-watchlist-rationale-modal__btn xf-watchlist-rationale-modal__btn--primary"
                disabled={mutating}
                type="button"
                onClick={() => void saveRationale()}
              >
                Save
              </button>
            </>
          ) : (
            <button
              className="xf-watchlist-rationale-modal__btn xf-watchlist-rationale-modal__btn--primary"
              disabled={mutating}
              type="button"
              onClick={() => {
                setRationaleDraft(row.rationale ?? "");
                setRationaleEditing(true);
              }}
            >
              Edit
            </button>
          )}
          <button
            className="xf-watchlist-ai-suggest"
            disabled={mutating || aiSuggestBusy}
            type="button"
            onClick={() => onAiSuggest(row)}
          >
            ✦ AI Suggest
          </button>
        </div>
      ) : null}
      {!editMode && !rationaleEditing ? (
        <div className="xf-watchlist-quote-panel__chart">
          <p className="xf-watchlist-rationale-modal__chart-label">Price action</p>
          <SymbolOhlcChartPanel enabled initialRange="1w" showRangeSelector symbol={row.symbol} variant="compact" />
        </div>
      ) : null}
    </div>
  );
}

export function WatchlistQuoteDetailPanel({
  row,
  activeTab,
  onTabChange,
  onClose,
  listLoadedAtLabel,
  portfolioTotalUsd,
  editMode,
  mutating,
  aiSuggestBusy,
  updateDraftRow,
  patchRowMeta,
  onAiSuggest
}: WatchlistQuoteDetailPanelProps) {
  const quoteTabId = `watchlist-quote-tab-${row.symbol}`;
  const rationaleTabId = `watchlist-rationale-tab-${row.symbol}`;
  const quotePanelId = `watchlist-quote-panel-${row.symbol}`;
  const rationalePanelId = `watchlist-rationale-panel-${row.symbol}`;

  return (
    <aside
      aria-label={`${row.symbol} quote and rationale`}
      aria-modal="true"
      className="xf-watchlist-quote-panel"
      role="dialog"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="xf-watchlist-quote-panel__head">
        <div className="xf-watchlist-quote-panel__brand">
          {row.quote?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote CDN; matches desk tiles
            <img
              alt=""
              className="xf-watchlist-quote-panel__logo"
              height={40}
              src={row.quote.logoUrl}
              width={40}
            />
          ) : (
            <div aria-hidden className="xf-watchlist-quote-panel__logo xf-watchlist-quote-panel__logo--fallback">
              {row.symbol.slice(0, 2)}
            </div>
          )}
          <div className="xf-watchlist-quote-panel__brand-text">
            <h3 className="xf-watchlist-quote-panel__title">{row.symbol} quote &amp; rationale</h3>
            <p className="xf-watchlist-quote-panel__delayed">US equity · delayed quote</p>
          </div>
        </div>
        <button aria-label="Close quote and rationale" className="xf-watchlist-quote-panel__close" type="button" onClick={onClose}>
          <XMarkIcon className="crud-icon" />
        </button>
      </div>

      <WatchlistQuotePanelDeskMeta
        editMode={editMode}
        mutating={mutating}
        patchRowMeta={patchRowMeta}
        portfolioTotalUsd={portfolioTotalUsd}
        row={row}
        updateDraftRow={updateDraftRow}
        onTabChange={onTabChange}
      />

      <div className="xf-watchlist-quote-panel__tabs" role="tablist" aria-label={`${row.symbol} quote and rationale`}>
        <button
          aria-controls={quotePanelId}
          aria-selected={activeTab === "quote"}
          className={`xf-watchlist-quote-panel__tab${activeTab === "quote" ? " xf-watchlist-quote-panel__tab--active" : ""}`}
          id={quoteTabId}
          role="tab"
          type="button"
          onClick={() => onTabChange("quote")}
        >
          Quote
        </button>
        <button
          aria-controls={rationalePanelId}
          aria-selected={activeTab === "rationale"}
          className={`xf-watchlist-quote-panel__tab${activeTab === "rationale" ? " xf-watchlist-quote-panel__tab--active" : ""}`}
          id={rationaleTabId}
          role="tab"
          type="button"
          onClick={() => onTabChange("rationale")}
        >
          Rationale
        </button>
      </div>

      <div
        aria-labelledby={quoteTabId}
        className="xf-watchlist-quote-panel__tab-panel"
        hidden={activeTab !== "quote"}
        id={quotePanelId}
        role="tabpanel"
      >
        <p className="xf-watchlist-quote-panel__asof">As of {listLoadedAtLabel || "latest refresh"}</p>
        <dl className="xf-watchlist-quote-panel__grid">
          <div>
            <dt>Quote</dt>
            <dd>{formatSpotCell(row)}</dd>
          </div>
          <div>
            <dt>Change</dt>
            <dd>
              {typeof row.quote?.change === "number" &&
              Number.isFinite(row.quote.change) &&
              typeof row.quote?.changePercent === "number" &&
              Number.isFinite(row.quote.changePercent)
                ? `${row.quote.change > 0 ? "+" : ""}${row.quote.change.toFixed(2)} (${row.quote.changePercent > 0 ? "+" : ""}${row.quote.changePercent.toFixed(2)}%)`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>
              {typeof row.quote?.volume === "number" && Number.isFinite(row.quote.volume)
                ? row.quote.volume.toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Day range</dt>
            <dd>
              {typeof row.quote?.low === "number" &&
              Number.isFinite(row.quote.low) &&
              typeof row.quote?.high === "number" &&
              Number.isFinite(row.quote.high)
                ? `${formatUsd2(row.quote.low)} - ${formatUsd2(row.quote.high)}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>52 week range</dt>
            <dd>
              {typeof row.quote?.fiftyTwoWeekLow === "number" &&
              Number.isFinite(row.quote.fiftyTwoWeekLow) &&
              typeof row.quote?.fiftyTwoWeekHigh === "number" &&
              Number.isFinite(row.quote.fiftyTwoWeekHigh)
                ? `${formatUsd2(row.quote.fiftyTwoWeekLow)} - ${formatUsd2(row.quote.fiftyTwoWeekHigh)}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{row.quote?.companyName?.trim() || row.symbol}</dd>
          </div>
        </dl>
        <div className="xf-watchlist-quote-panel__chart">
          <SymbolOhlcChartPanel enabled initialRange="1d" showRangeSelector symbol={row.symbol} variant="compact" />
        </div>
        <p className="xf-watchlist-quote-panel__foot">Data source: Yahoo Finance.</p>
      </div>

      <div
        aria-labelledby={rationaleTabId}
        className="xf-watchlist-quote-panel__tab-panel"
        hidden={activeTab !== "rationale"}
        id={rationalePanelId}
        role="tabpanel"
      >
        <WatchlistQuoteRationaleTab
          key={`${row.symbol}:${row.rationale ?? ""}`}
          aiSuggestBusy={aiSuggestBusy}
          editMode={editMode}
          mutating={mutating}
          patchRowMeta={patchRowMeta}
          row={row}
          updateDraftRow={updateDraftRow}
          onAiSuggest={onAiSuggest}
        />
      </div>
    </aside>
  );
}
