"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { OptionsActionReportRow } from "@/modules/xchat/options-action-scan";
import type { OptionsActionScanDisplayData } from "@/modules/xchat/options-action-scan-display";
import { parseOccOptionSymbol } from "@/modules/watchlist/option-expiration";

type ConfidenceDots = "●●●" | "●●" | "●";
type SortKey = "symbol" | "action" | "urgency" | "confidence" | "expiry";
type SortState = { key: SortKey; dir: "asc" | "desc" };

const urgencyOrder: Record<OptionsActionReportRow["urgency"], number> = {
  high: 3,
  med: 2,
  low: 1
};

const confidenceOrder: Record<OptionsActionReportRow["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1
};

const defaultSort: SortState = { key: "urgency", dir: "desc" };

type ShareCreateResponse = {
  shareUrl: string;
  expiresAt: string;
  expiresIn: string;
};

type OptionsActionScanReportProps = {
  data: OptionsActionScanDisplayData;
  shareMode?: "enabled" | "disabled";
  title?: string;
  showHeaderSummary?: boolean;
};

type RowInstrument = {
  symbol: string;
  strike?: number;
  exp?: string;
  type?: "call" | "put";
};

function confidenceDots(confidence: OptionsActionReportRow["confidence"]): ConfidenceDots {
  if (confidence === "high") {
    return "●●●";
  }
  if (confidence === "medium") {
    return "●●";
  }
  return "●";
}

function toRowInstrument(row: OptionsActionReportRow): RowInstrument {
  if (row.strike != null && row.exp && row.type) {
    return {
      symbol: row.symbol,
      strike: row.strike,
      exp: row.exp,
      type: row.type
    };
  }
  const occ = parseOccOptionSymbol(row.symbol);
  if (!occ) {
    return { symbol: row.symbol };
  }
  return {
    symbol: occ.underlying,
    strike: occ.strike,
    exp: occ.expYmd,
    type: occ.optionType
  };
}

function instrumentLabel(row: OptionsActionReportRow): string {
  const instrument = toRowInstrument(row);
  if (instrument.strike == null || !instrument.exp || !instrument.type) {
    return instrument.symbol;
  }
  return `${instrument.symbol} ${instrument.strike.toFixed(2)} ${instrument.type.toUpperCase()} (${instrument.exp})`;
}

function compareRows(a: OptionsActionReportRow, b: OptionsActionReportRow, sort: SortState): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "symbol") {
    return dir * a.symbol.localeCompare(b.symbol);
  }
  if (sort.key === "action") {
    return dir * a.recommendedAction.localeCompare(b.recommendedAction);
  }
  if (sort.key === "urgency") {
    return dir * (urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  }
  if (sort.key === "confidence") {
    return dir * (confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);
  }
  const aExp = toRowInstrument(a).exp ?? "";
  const bExp = toRowInstrument(b).exp ?? "";
  return dir * aExp.localeCompare(bExp);
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function exportCsv(data: OptionsActionScanDisplayData): void {
  const lines = [
    [
      "source",
      "symbol",
      "strike",
      "expiration",
      "type",
      "qty",
      "recommendedAction",
      "urgency",
      "confidence",
      "targetWindow",
      "why"
    ].join(",")
  ];
  for (const row of data.rows) {
    const instrument = toRowInstrument(row);
    lines.push(
      [
        row.source,
        instrument.symbol,
        instrument.strike != null ? instrument.strike.toFixed(2) : "",
        instrument.exp ?? "",
        instrument.type ?? "",
        row.qty != null ? String(row.qty) : "",
        row.recommendedAction,
        row.urgency,
        row.confidence,
        row.targetWindow,
        csvEscape(row.why)
      ].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `options-action-scan-${new Date(data.generatedAt).toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(data: OptionsActionScanDisplayData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const generatedAtLabel = new Date(data.generatedAt).toLocaleString();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Options Action Scan", 42, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${generatedAtLabel}`, 42, 64);
  const holdings = data.rows.filter((row) => row.source === "holding");
  const watchlist = data.rows.filter((row) => row.source === "watchlist");

  autoTable(doc, {
    startY: 80,
    head: [["Holdings - Recommended Close (STC)"]],
    body: [[""]],
    theme: "plain",
    headStyles: { fillColor: [24, 33, 47], textColor: [230, 235, 242], fontSize: 11 },
    bodyStyles: { minCellHeight: 0, cellPadding: 0 }
  });
  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 102,
    head: [["Instrument", "Action", "Urgency", "Confidence", "Window", "Why"]],
    body: holdings.map((row) => [
      instrumentLabel(row),
      row.recommendedAction,
      row.urgency.toUpperCase(),
      row.confidence.toUpperCase(),
      row.targetWindow,
      row.why
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
    styles: { fontSize: 8, overflow: "linebreak" }
  });
  autoTable(doc, {
    startY: ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300) + 12,
    head: [["Watchlist - Monitoring Queue"]],
    body: [[""]],
    theme: "plain",
    headStyles: { fillColor: [24, 33, 47], textColor: [230, 235, 242], fontSize: 11 },
    bodyStyles: { minCellHeight: 0, cellPadding: 0 }
  });
  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 332,
    head: [["Instrument", "Action", "Urgency", "Confidence", "Window", "Why"]],
    body: watchlist.map((row) => [
      instrumentLabel(row),
      row.recommendedAction,
      row.urgency.toUpperCase(),
      row.confidence.toUpperCase(),
      row.targetWindow,
      row.why
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
    styles: { fontSize: 8, overflow: "linebreak" }
  });
  const footerY = Math.min(
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 700) + 18,
    744
  );
  doc.setFontSize(9);
  doc.text(data.disclaimer, 42, footerY, { maxWidth: 520 });
  doc.save(`options-action-scan-${new Date(data.generatedAt).toISOString().slice(0, 10)}.pdf`);
}

function toXoptionsHref(row: OptionsActionReportRow): string {
  const instrument = toRowInstrument(row);
  const params = new URLSearchParams({
    symbol: instrument.symbol.trim().toUpperCase(),
    step: "4"
  });
  if (instrument.strike != null && instrument.exp && instrument.type) {
    params.set("strike", instrument.strike.toFixed(2));
    params.set("expiration", instrument.exp);
    params.set("contractType", instrument.type);
  }
  return `/xoptions?${params.toString()}`;
}

function badgeTone(
  kind: "urgency" | "confidence",
  value: OptionsActionReportRow["urgency"] | OptionsActionReportRow["confidence"]
): string {
  if (kind === "urgency") {
    if (value === "high") {
      return "bg-[color-mix(in_srgb,var(--xf-danger-400)_22%,transparent)] text-[var(--xf-danger-400)]";
    }
    if (value === "med") {
      return "bg-[color-mix(in_srgb,var(--xf-warning-400)_22%,transparent)] text-[var(--xf-warning-400)]";
    }
    return "bg-[color-mix(in_srgb,var(--xf-text-400)_22%,transparent)] text-[var(--xf-text-300)]";
  }
  if (value === "high") {
    return "bg-[color-mix(in_srgb,var(--xf-gain-green)_22%,transparent)] text-[var(--xf-gain-green)]";
  }
  if (value === "medium") {
    return "bg-[color-mix(in_srgb,var(--xf-warning-400)_20%,transparent)] text-[var(--xf-warning-400)]";
  }
  return "bg-[color-mix(in_srgb,var(--xf-danger-400)_20%,transparent)] text-[var(--xf-danger-400)]";
}

function closeRecommendationCount(rows: OptionsActionReportRow[]): number {
  return rows.filter(
    (row) =>
      row.source === "holding" &&
      (row.recommendedAction === "STC" ||
        row.recommendedAction === "BTC" ||
        row.recommendedAction === "LET_EXPIRE")
  ).length;
}

function sortToggle(current: SortState, nextKey: SortKey): SortState {
  if (current.key !== nextKey) {
    return { key: nextKey, dir: nextKey === "symbol" ? "asc" : "desc" };
  }
  return { key: nextKey, dir: current.dir === "asc" ? "desc" : "asc" };
}

function sectionRows(rows: OptionsActionReportRow[], source: OptionsActionReportRow["source"], sort: SortState) {
  return rows.filter((row) => row.source === source).sort((a, b) => compareRows(a, b, sort));
}

export function OptionsActionScanReport({
  data,
  shareMode = "enabled",
  title = "Options Action Scan",
  showHeaderSummary = true
}: OptionsActionScanReportProps) {
  const [holdingSort, setHoldingSort] = useState<SortState>(defaultSort);
  const [watchlistSort, setWatchlistSort] = useState<SortState>(defaultSort);
  const [shareBusy, setShareBusy] = useState(false);
  const [share, setShare] = useState<ShareCreateResponse | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const generatedAtLabel = useMemo(() => new Date(data.generatedAt).toLocaleString(), [data.generatedAt]);
  const holdings = useMemo(
    () => sectionRows(data.rows, "holding", holdingSort),
    [data.rows, holdingSort]
  );
  const watchlist = useMemo(
    () => sectionRows(data.rows, "watchlist", watchlistSort),
    [data.rows, watchlistSort]
  );
  const closeCount = useMemo(() => closeRecommendationCount(data.rows), [data.rows]);
  const highConfidenceStc = useMemo(
    () =>
      holdings.find(
        (row) => row.recommendedAction === "STC" && row.confidence === "high"
      )?.symbol ?? holdings.find((row) => row.confidence === "high")?.symbol,
    [holdings]
  );
  const summaryLine = `${closeCount} holdings recommended to close • ${watchlist.length} watchlist symbols monitoring • ${highConfidenceStc ? `HIGH confidence on ${highConfidenceStc}` : "No HIGH confidence signal"}`;
  const genericWatchlistCount = useMemo(
    () =>
      watchlist.filter((row) => {
        const parsed = toRowInstrument(row);
        return !(parsed.strike != null && parsed.exp && parsed.type);
      }).length,
    [watchlist]
  );

  async function createShareLink() {
    setShareBusy(true);
    setShareError(null);
    try {
      const response = await fetch("/api/reports/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanData: {
            generatedAt: data.generatedAt,
            planTier: data.planTier,
            truncated: data.truncated,
            rows: data.rows,
            disclaimer: data.disclaimer
          }
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: ShareCreateResponse;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not create share link");
      }
      setShare(payload.data);
      await navigator.clipboard.writeText(payload.data.shareUrl).catch(() => {});
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not create share link");
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-surface-700)] p-4 sm:p-5">
      <header className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-[var(--xf-text-100)]">{title}</h2>
          <span className="rounded-full border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--xf-text-300)]">
            {generatedAtLabel}
          </span>
          <span className="rounded-full border border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_14%,transparent)] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.09em] text-[var(--xf-gain-green)]">
            Advisor
          </span>
        </div>
        {showHeaderSummary ? (
          <p className="rounded-md border border-[color-mix(in_srgb,var(--xf-lightning-yellow)_24%,transparent)] bg-[color-mix(in_srgb,var(--xf-lightning-yellow)_10%,transparent)] px-2.5 py-1.5 text-xs text-[var(--xf-text-200)]">
            {summaryLine}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_35%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--xf-xoptions-accent)] transition hover:bg-[color-mix(in_srgb,var(--xf-xoptions-accent)_12%,transparent)]"
            type="button"
            onClick={() => exportPdf(data)}
          >
            Download PDF Report
          </button>
          <button
            className="rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--xf-text-200)] transition hover:bg-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)]"
            type="button"
            onClick={() => exportCsv(data)}
          >
            Export CSV
          </button>
          {shareMode === "enabled" ? (
            <button
              className="rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--xf-gain-green)] transition hover:bg-[color-mix(in_srgb,var(--xf-gain-green)_12%,transparent)] disabled:opacity-60"
              disabled={shareBusy}
              type="button"
              onClick={() => void createShareLink()}
            >
              {shareBusy ? "Creating link…" : "Create Temporary Share Link (24h)"}
            </button>
          ) : null}
        </div>
        {share ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_12%,transparent)] px-2.5 py-2 text-xs">
            <span className="font-medium text-[var(--xf-text-100)]">{share.shareUrl}</span>
            <button
              className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] px-1.5 py-0.5 text-[0.68rem] text-[var(--xf-text-200)]"
              type="button"
              onClick={() => void navigator.clipboard.writeText(share.shareUrl)}
            >
              Copy
            </button>
            <span className="text-[var(--xf-text-400)]">Expires {new Date(share.expiresAt).toLocaleString()}</span>
          </div>
        ) : null}
        {shareError ? (
          <p className="text-xs text-[var(--xf-danger-400)]" role="alert">
            {shareError}
          </p>
        ) : null}
      </header>

      <div className="mt-4 space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--xf-text-100)]">
            📈 Holdings — Recommended Close (STC)
          </h3>
          <ReportTable
            rows={holdings}
            sort={holdingSort}
            onSortChange={setHoldingSort}
            showGenericHelper={false}
          />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--xf-text-100)]">
            👁️ Watchlist — Monitoring Queue
          </h3>
          <ReportTable
            rows={watchlist}
            sort={watchlistSort}
            onSortChange={setWatchlistSort}
            showGenericHelper
          />
          {genericWatchlistCount > 0 ? (
            <p className="mt-2 text-xs text-[var(--xf-text-400)]">
              Define entry criteria in xStrategyBuilder for generic monitoring rows.
            </p>
          ) : null}
        </section>

        <aside className="rounded-md border border-[color-mix(in_srgb,var(--xf-lightning-yellow)_25%,transparent)] bg-[color-mix(in_srgb,var(--xf-lightning-yellow)_10%,transparent)] px-3 py-2">
          <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--xf-text-100)]">Key Insights</h4>
          <p className="mt-1 text-xs text-[var(--xf-text-200)]">
            {closeCount} close candidates across active holdings, {watchlist.length} watchlist symbols still monitoring,
            and {highConfidenceStc ? ` strongest conviction currently ${highConfidenceStc}.` : " no high-confidence conviction ticker yet."}
          </p>
          <p className="mt-1 text-[0.68rem] text-[var(--xf-text-400)]">{data.disclaimer}</p>
        </aside>
      </div>
    </section>
  );
}

function ReportTable(props: {
  rows: OptionsActionReportRow[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  showGenericHelper: boolean;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] sm:block">
        <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[color-mix(in_srgb,var(--xf-text-100)_6%,transparent)]">
              <SortTh label="Instrument" sortKey="symbol" {...props} />
              <SortTh label="Action" sortKey="action" {...props} />
              <SortTh label="Urgency" sortKey="urgency" {...props} />
              <SortTh label="Confidence" sortKey="confidence" {...props} />
              <SortTh label="Exp" sortKey="expiry" {...props} />
              <th className="px-2 py-2 font-semibold uppercase tracking-[0.07em] text-[var(--xf-text-400)]">Why</th>
              <th className="px-2 py-2 font-semibold uppercase tracking-[0.07em] text-[var(--xf-text-400)]">Open</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-[var(--xf-text-400)]" colSpan={7}>
                  No rows.
                </td>
              </tr>
            ) : (
              props.rows.map((row, idx) => {
                const instrument = toRowInstrument(row);
                const generic = !(instrument.strike != null && instrument.exp && instrument.type);
                const isSpecialLunr =
                  instrument.symbol === "LUNR" &&
                  instrument.type === "put" &&
                  instrument.exp?.endsWith("-05-01") &&
                  Math.abs((instrument.strike ?? 0) - 27.5) < 0.001;
                return (
                  <tr
                    className="border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] transition hover:bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)]"
                    key={`${row.source}-${row.symbol}-${idx}`}
                  >
                    <td className="px-2 py-2 text-[var(--xf-text-100)]">{instrumentLabel(row)}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          row.recommendedAction === "STC"
                            ? "font-bold text-[var(--xf-danger-400)]"
                            : "font-semibold text-[var(--xf-text-200)]"
                        }
                      >
                        {row.recommendedAction}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase ${badgeTone("urgency", row.urgency)}`}>
                        {row.urgency}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase ${badgeTone("confidence", row.confidence)}`}>
                        {row.confidence} {confidenceDots(row.confidence)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[var(--xf-text-300)]">{instrument.exp ?? "—"}</td>
                    <td className="px-2 py-2">
                      <span className="block max-w-[30ch] truncate text-[var(--xf-text-300)]" title={row.why}>
                        {row.why}
                      </span>
                      {props.showGenericHelper && generic ? (
                        <span className="block text-[0.64rem] text-[var(--xf-text-500)]">
                          Define entry criteria in xStrategyBuilder
                        </span>
                      ) : null}
                      {isSpecialLunr ? (
                        <span className="block text-[0.64rem] text-[var(--xf-lightning-yellow)]">Special setup: LUNR 27.50 PUT (May 1)</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        className="inline-flex items-center rounded border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_35%,transparent)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--xf-xoptions-accent)] hover:bg-[color-mix(in_srgb,var(--xf-xoptions-accent)_12%,transparent)]"
                        href={toXoptionsHref(row)}
                      >
                        Open in xOptions
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 sm:hidden">
        {props.rows.length === 0 ? (
          <p className="text-xs text-[var(--xf-text-400)]">No rows.</p>
        ) : (
          props.rows.map((row, idx) => {
            return (
              <article
                className="rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-2.5"
                key={`${row.source}-${row.symbol}-mobile-${idx}`}
              >
                <p className="text-sm font-semibold text-[var(--xf-text-100)]">{instrumentLabel(row)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold uppercase ${badgeTone("urgency", row.urgency)}`}>
                    {row.urgency}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold uppercase ${badgeTone("confidence", row.confidence)}`}>
                    {row.confidence} {confidenceDots(row.confidence)}
                  </span>
                  <span
                    className={
                      row.recommendedAction === "STC"
                        ? "text-[0.7rem] font-bold text-[var(--xf-danger-400)]"
                        : "text-[0.7rem] font-semibold text-[var(--xf-text-200)]"
                    }
                  >
                    {row.recommendedAction}
                  </span>
                </div>
                <p className="mt-1 text-[0.72rem] text-[var(--xf-text-300)]">{row.why}</p>
                <Link
                  className="mt-2 inline-flex items-center rounded border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_35%,transparent)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--xf-xoptions-accent)]"
                  href={toXoptionsHref(row)}
                >
                  Open in xOptions
                </Link>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}

function SortTh(props: {
  label: string;
  sortKey: SortKey;
  rows: OptionsActionReportRow[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  showGenericHelper: boolean;
}) {
  const isActive = props.sort.key === props.sortKey;
  return (
    <th className="px-2 py-2">
      <button
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.07em] text-[var(--xf-text-400)]"
        type="button"
        onClick={() => props.onSortChange(sortToggle(props.sort, props.sortKey))}
      >
        {props.label}
        <span className="text-[0.6rem]">{isActive ? (props.sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}
