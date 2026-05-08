"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

import type { BrokerImportPreviewSampleRow } from "@/modules/portfolio-import/broker-import-dry-run-preview";

import type { BrokerPreviewAccount } from "./import-activity-types";

export type ImportActivityPreviewPanelProps = {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  /** Sum of positionCount across broker accounts in preview (full parse, not sample cap). */
  totalPositionsParsed: number;
  /** Selected preview rows only — positions that would apply with current Import toggles. */
  selectedPositionsEstimate: number;
  deleteExistingHoldingsFirst: boolean;
  accountMappingHealthy: boolean;
  mappingIssueLabels: string[];
  previewWarnings: string[];
  sampleRows: BrokerImportPreviewSampleRow[];
  brokerPreviewAccounts: BrokerPreviewAccount[];
  importRowSelected: Record<string, boolean>;
  brokerImportPreviewRowKey: (row: BrokerPreviewAccount) => string;
  onToggleImportRow: (rowKey: string, checked: boolean) => void;
  onApplyImport: () => void;
  onEditSelection: () => void;
  canApplyImport: boolean;
};

const ROW_H = 34;

export function ImportActivityPreviewPanel({
  open,
  onClose,
  busy,
  totalPositionsParsed,
  selectedPositionsEstimate,
  deleteExistingHoldingsFirst,
  accountMappingHealthy,
  mappingIssueLabels,
  previewWarnings,
  sampleRows,
  brokerPreviewAccounts,
  importRowSelected,
  brokerImportPreviewRowKey,
  onToggleImportRow,
  onApplyImport,
  onEditSelection,
  canApplyImport
}: ImportActivityPreviewPanelProps) {
  const scrollParentRef = useRef<HTMLDivElement>(null);

  /* eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual */
  const rowVirtualizer = useVirtualizer({
    count: sampleRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => ROW_H,
    overscan: 6
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="import-activity-preview-root" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
      <button
        type="button"
        className="import-activity-preview-backdrop"
        aria-label="Close import preview"
        onClick={onClose}
      />
      <div className="import-activity-preview-sheet">
        <header className="import-activity-preview-header">
          <h2 id="import-preview-title" className="import-activity-preview-title">
            Import Preview — Dry Run
          </h2>
          <button type="button" className="import-activity-preview-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="import-activity-preview-body">
          <section className="import-activity-preview-metrics" aria-label="Preview summary">
            <div className="import-activity-preview-metric">
              <span className="import-activity-preview-metric-label">Positions (parsed)</span>
              <span className="import-activity-preview-metric-value">{totalPositionsParsed}</span>
            </div>
            <div className="import-activity-preview-metric">
              <span className="import-activity-preview-metric-label">Selected for apply</span>
              <span className="import-activity-preview-metric-value">{selectedPositionsEstimate}</span>
            </div>
            {!deleteExistingHoldingsFirst ? (
              <>
                <div className="import-activity-preview-metric import-activity-preview-metric--muted">
                  <span className="import-activity-preview-metric-label">New</span>
                  <span className="import-activity-preview-metric-value">—</span>
                </div>
                <div className="import-activity-preview-metric import-activity-preview-metric--muted">
                  <span className="import-activity-preview-metric-label">Updated</span>
                  <span className="import-activity-preview-metric-value">—</span>
                </div>
                <div className="import-activity-preview-metric import-activity-preview-metric--muted">
                  <span className="import-activity-preview-metric-label">Deleted</span>
                  <span className="import-activity-preview-metric-value">—</span>
                </div>
                <p className="import-activity-preview-merge-hint">
                  Merge mode: dry run does not diff MongoDB — counts shown after apply only.
                </p>
              </>
            ) : (
              <div className="import-activity-preview-metric import-activity-preview-metric--wide">
                <span className="import-activity-preview-metric-label">Replace mode</span>
                <span className="import-activity-preview-metric-value text-[0.7rem] font-normal leading-tight">
                  Delete existing holdings ON — full book replace before CSV apply.
                </span>
              </div>
            )}
            <div
              className={`import-activity-preview-metric import-activity-preview-metric--wide ${accountMappingHealthy ? "import-activity-preview-metric--ok" : "import-activity-preview-metric--warn"}`}
            >
              <span className="import-activity-preview-metric-label">Account mapping</span>
              <span className="import-activity-preview-metric-value text-[0.72rem] font-semibold">
                {accountMappingHealthy ? "✓ Broker ref last-4 match for selected rows" : "⚠ Unmatched broker refs"}
              </span>
            </div>
          </section>

          {!accountMappingHealthy && mappingIssueLabels.length > 0 ? (
            <p className="import-activity-preview-warn-copy">
              No portfolio match: {mappingIssueLabels.slice(0, 6).join(", ")}
              {mappingIssueLabels.length > 6 ? "…" : ""}
            </p>
          ) : null}

          <p className="import-activity-preview-note">{importActivityPreviewRiskNote}</p>

          <div className="import-activity-preview-account-toggles">
            <span className="import-activity-preview-section-label">Include broker accounts</span>
            <ul className="import-activity-preview-chip-list">
              {brokerPreviewAccounts.map((row) => {
                const key = brokerImportPreviewRowKey(row);
                const on = importRowSelected[key] === true;
                return (
                  <li key={key}>
                    <label className="import-activity-preview-chip">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => onToggleImportRow(key, e.target.checked)}
                        className="import-activity-preview-chip-input"
                      />
                      <span>{row.label || row.accountRef}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="import-activity-preview-table-wrap">
            <div className="import-activity-preview-table-header">
              <span className="import-activity-preview-col-account">Account</span>
              <span className="import-activity-preview-col-symbol">Symbol</span>
              <span className="import-activity-preview-col-qty">Qty</span>
              <span className="import-activity-preview-col-num">Avg</span>
              <span className="import-activity-preview-col-num">Last</span>
              <span className="import-activity-preview-col-num">Value</span>
              <span className="import-activity-preview-col-type">Type</span>
            </div>
            <div ref={scrollParentRef} className="import-activity-preview-table-scroll">
              <div
                className="import-activity-preview-table-virtual-inner"
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
              >
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const r = sampleRows[vi.index];
                  if (!r) {
                    return null;
                  }
                  return (
                    <div
                      key={vi.key}
                      className="import-activity-preview-table-row"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${vi.size}px`,
                        transform: `translateY(${vi.start}px)`
                      }}
                    >
                      <span className="import-activity-preview-col-account truncate" title={r.accountLabel}>
                        {r.accountLabel}
                      </span>
                      <span className="import-activity-preview-col-symbol truncate font-mono text-[0.65rem]" title={r.symbol}>
                        {r.symbol}
                      </span>
                      <span className="import-activity-preview-col-qty font-mono tabular-nums">{r.qty}</span>
                      <span className="import-activity-preview-col-num font-mono tabular-nums">{r.avgCost}</span>
                      <span className="import-activity-preview-col-num font-mono tabular-nums">{r.last}</span>
                      <span className="import-activity-preview-col-num font-mono tabular-nums">{r.value}</span>
                      <span className="import-activity-preview-col-type">{r.rowType}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {sampleRows.length === 0 ? (
              <p className="import-activity-preview-empty">No sample rows returned for this file.</p>
            ) : (
              <p className="import-activity-preview-sample-foot">
                Showing first {sampleRows.length} position row{sampleRows.length === 1 ? "" : "s"} (sample).
              </p>
            )}
          </div>

          {previewWarnings.length > 0 ? (
            <ul className="import-activity-preview-warnings">
              {previewWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <footer className="import-activity-preview-footer">
          <button type="button" className="import-activity__btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="import-activity__btn-secondary" disabled={busy} onClick={onEditSelection}>
            Edit selection
          </button>
          <button
            type="button"
            className="import-activity__btn-primary"
            disabled={busy || !canApplyImport}
            onClick={onApplyImport}
          >
            Apply import
          </button>
        </footer>
      </div>
    </div>
  );
}

const importActivityPreviewRiskNote =
  "Net-long option legs only; net-short legs skipped until short modeling is enabled.";
