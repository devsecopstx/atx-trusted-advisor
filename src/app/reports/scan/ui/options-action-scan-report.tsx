"use client";

import {
    QueryClient,
    QueryClientProvider,
    useMutation,
    useQuery,
    useQueryClient
} from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatExpirationShortLabel } from "@/lib/xoptions/xoptions-order-preview";
import { parseOccOptionSymbol } from "@/modules/watchlist/option-expiration";
import type { OptionsActionReportRow } from "@/modules/xchat/options-action-scan";
import type { OptionsActionScanDisplayData } from "@/modules/xchat/options-action-scan-display";

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

type ApplyWatchlistResponse = {
  data: {
    rowId: string;
    symbol: string;
    portfolioId: string;
    watchlist: {
      symbolCount: number;
      applied: boolean;
      alreadyPresent: boolean;
    };
    priceAlert: {
      _id: string;
      title: string;
      body: string | null;
      severity: "info" | "warning" | "critical";
      symbol: string | null;
      createdAt: string;
    } | null;
  };
};

type ApplyCacheRow = {
  status: "pending" | "success" | "error";
  message?: string;
};

type ApplyCacheData = Record<string, ApplyCacheRow>;

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
      "portfolioAccountId",
      "portfolioAccountName",
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
        row.portfolioAccountId ?? "",
        csvEscape(row.portfolioAccountName ?? ""),
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
    head: [["Instrument", "Book", "Action", "Urgency", "Confidence", "Window", "Why"]],
    body: holdings.map((row) => [
      instrumentLabel(row),
      row.portfolioAccountName?.trim() || row.portfolioAccountId || "—",
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

async function exportPolishedPdf(data: OptionsActionScanDisplayData, title: string): Promise<void> {
  const response = await fetch("/api/reports/options-scan", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      scanData: {
        generatedAt: data.generatedAt,
        planTier: data.planTier,
        truncated: data.truncated,
        rows: data.rows,
        disclaimer: data.disclaimer
      }
    })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(payload.error ?? payload.details ?? `Report request failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `options-action-scan-${new Date(data.generatedAt).toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
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

function toPortfolioAccountHref(accountId: string): string {
  return `/portfolio/accounts/${accountId}`;
}

function BookCell({ row }: { row: OptionsActionReportRow }) {
  if (!row.portfolioAccountId) {
    return <span className="text-[0.62rem] text-[var(--xf-text-500)]">—</span>;
  }
  return (
    <div className="flex max-w-[10rem] flex-col gap-1">
      <span
        className="line-clamp-2 text-[0.68rem] font-medium leading-snug text-[var(--xf-text-200)]"
        title={row.portfolioAccountName ?? row.portfolioAccountId}
      >
        {row.portfolioAccountName ?? "Book"}
      </span>
      <Link
        className="inline-flex w-fit items-center rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_42%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] px-3 py-1 text-xs font-bold text-[var(--xf-gain-green)] xf-shadow-hairline-inset hover:bg-[color-mix(in_srgb,var(--xf-gain-green)_18%,transparent)]"
        href={toPortfolioAccountHref(row.portfolioAccountId)}
      >
        Open book
      </Link>
    </div>
  );
}

function scanDteDays(yyyyMmDd: string | undefined): number | null {
  if (!yyyyMmDd || yyyyMmDd.length < 10) {
    return null;
  }
  const exp = new Date(`${yyyyMmDd.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(exp.getTime())) {
    return null;
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  return Math.max(0, Math.ceil((expUtc - todayUtc) / 86400000));
}

function UrgencyAlertIcon() {
  return (
    <svg aria-hidden className="h-3 w-3 shrink-0 opacity-95" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2 14 13H2L8 2Zm0 9.25a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7ZM7.25 7h1.5v3h-1.5V7Z" />
    </svg>
  );
}

function UrgencyBadge({ urgency }: { urgency: OptionsActionReportRow["urgency"] }) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider";
  if (urgency === "high") {
    return (
      <span
        className={`${base} bg-[color-mix(in_srgb,var(--xf-danger-400)_58%,var(--xf-bg-900))] text-[var(--xf-text-100)] xf-shadow-hairline-inset-12 ring-1 ring-[color-mix(in_srgb,var(--xf-danger-400)_55%,transparent)]`}
      >
        <UrgencyAlertIcon />
        high
      </span>
    );
  }
  if (urgency === "med") {
    return (
      <span
        className={`${base} bg-[color-mix(in_srgb,var(--xf-warning-400)_48%,var(--xf-bg-900))] text-[var(--xf-text-100)] ring-1 ring-[color-mix(in_srgb,var(--xf-warning-400)_42%,transparent)]`}
      >
        med
      </span>
    );
  }
  return (
    <span
      className={`${base} bg-[color-mix(in_srgb,var(--xf-text-400)_22%,var(--xf-surface-600))] text-[var(--xf-text-200)] ring-1 ring-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)]`}
    >
      low
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: OptionsActionReportRow["confidence"] }) {
  const filled = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
  const label = confidence.toUpperCase();
  const accent =
    confidence === "high"
      ? "var(--xf-gain-green)"
      : confidence === "medium"
        ? "var(--xf-warning-400)"
        : "var(--xf-text-400)";
  const emptySeg =
    "h-1 flex-1 rounded-[2px] bg-[color-mix(in_srgb,var(--xf-bg-900)_55%,transparent)]";
  return (
    <span
      className="inline-flex min-w-[5.75rem] flex-col gap-1 rounded-full border px-2.5 py-1 xf-shadow-hairline-inset"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 34%, transparent)`,
        background: `color-mix(in srgb, ${accent} 12%, var(--xf-bg-900))`
      }}
    >
      <span
        className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider"
        style={{ color: accent }}
      >
        <span>{label}</span>
        <span className="font-mono text-[0.58rem] opacity-90">{confidenceDots(confidence)}</span>
      </span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={emptySeg}
            style={
              i < filled
                ? {
                    background: accent,
                    boxShadow: `0 0 8px color-mix(in srgb, ${accent} 38%, transparent)`
                  }
                : undefined
            }
          />
        ))}
      </span>
    </span>
  );
}

function InstrumentStack({ row }: { row: OptionsActionReportRow }) {
  const instrument = toRowInstrument(row);
  if (instrument.strike == null || !instrument.exp || !instrument.type) {
    return (
      <div className="flex flex-col gap-0.5 py-0.5">
        <span className="text-[15px] font-semibold leading-tight tracking-tight text-[var(--xf-text-100)]">
          {instrument.symbol}
        </span>
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--xf-text-500)]">
          Chain
        </span>
      </div>
    );
  }
  const typeHue =
    instrument.type === "call"
      ? "text-[color-mix(in_srgb,var(--xf-gain-green)_78%,var(--xf-text-100)_22%)]"
      : "text-[color-mix(in_srgb,var(--xf-danger-400)_82%,var(--xf-text-100)_18%)]";
  const shortExp = formatExpirationShortLabel(instrument.exp);
  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <span className="text-[15px] font-semibold leading-tight tracking-tight text-[var(--xf-text-100)]">
        {instrument.symbol}
      </span>
      <span className={`font-mono text-[0.72rem] font-semibold tabular-nums ${typeHue}`}>
        {instrument.strike.toFixed(2)} {instrument.type.toUpperCase()}
      </span>
      <span className="font-mono text-[0.64rem] tabular-nums text-[var(--xf-text-400)]">{shortExp}</span>
    </div>
  );
}

function ExpiryCell({ exp }: { exp: string | undefined }) {
  const dte = scanDteDays(exp);
  return (
    <div className="flex flex-col items-end gap-1 text-right">
      {exp ? (
        <span className="font-mono text-[0.65rem] tabular-nums text-[var(--xf-text-400)]">{exp}</span>
      ) : (
        <span className="text-[0.65rem] text-[var(--xf-text-500)]">—</span>
      )}
      {dte != null ? (
        <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--xf-text-100)_16%,transparent)] bg-[color-mix(in_srgb,var(--xf-surface-600)_92%,transparent)] px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold uppercase tracking-wide text-[var(--xf-text-300)]">
          DTE {dte}
        </span>
      ) : null}
    </div>
  );
}

function WhyCell(props: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
  showGenericHelper: boolean;
  generic: boolean;
  isSpecialLunr: boolean;
}) {
  const firstBreak = props.text.search(/[.!?]\s/);
  const head = firstBreak > 0 ? props.text.slice(0, firstBreak + 1) : props.text;
  const tail = firstBreak > 0 ? props.text.slice(firstBreak + 1).trim() : "";
  return (
    <div
      role="button"
      tabIndex={0}
      title={props.expanded ? undefined : props.text}
      className="group/why max-w-full cursor-pointer rounded-md px-1 py-0.5 text-left outline-none transition hover:bg-[color-mix(in_srgb,var(--xf-text-100)_6%,transparent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--xf-tenant-primary)_45%,transparent)] sm:max-w-[min(18rem,34vw)]"
      onClick={(event) => {
        event.stopPropagation();
        props.onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onToggle();
        }
      }}
    >
      <div
        className={
          props.expanded ? "text-[0.72rem] leading-snug" : "line-clamp-2 text-[0.72rem] leading-snug"
        }
      >
        <span className="text-[var(--xf-text-200)]">{head}</span>
        {tail ? <span className="text-[var(--xf-text-400)] italic"> {tail}</span> : null}
      </div>
      <span className="mt-0.5 block text-[0.58rem] font-medium text-[var(--xf-text-400)] opacity-0 transition group-hover/why:opacity-100">
        {props.expanded ? "Click to collapse" : "Click for full rationale"}
      </span>
      {props.showGenericHelper && props.generic ? (
        <span className="mt-1 block text-[0.64rem] text-[var(--xf-text-500)]">
          Define entry criteria in xStrategyBuilder
        </span>
      ) : null}
      {props.isSpecialLunr ? (
        <span className="mt-1 block text-[0.64rem] text-[var(--xf-lightning-yellow)]">
          Special setup: LUNR 27.50 PUT (May 1)
        </span>
      ) : null}
    </div>
  );
}

function actionLabelClasses(action: OptionsActionReportRow["recommendedAction"]): string {
  if (action === "STC" || action === "BTC") {
    return "inline-flex rounded-md bg-[color-mix(in_srgb,var(--xf-danger-400)_24%,transparent)] px-2 py-0.5 text-[0.72rem] font-extrabold tracking-wide text-[var(--xf-danger-400)] ring-1 ring-[color-mix(in_srgb,var(--xf-danger-400)_42%,transparent)] xf-shadow-hairline-inset-10";
  }
  if (action === "LET_EXPIRE") {
    return "inline-flex rounded-md bg-[color-mix(in_srgb,var(--xf-warning-400)_18%,transparent)] px-2 py-0.5 text-[0.72rem] font-bold tracking-wide text-[var(--xf-warning-400)] ring-1 ring-[color-mix(in_srgb,var(--xf-warning-400)_35%,transparent)]";
  }
  return "text-[0.72rem] font-bold tracking-wide text-[var(--xf-text-200)]";
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

function OptionsActionScanReportInner({
  data,
  shareMode = "enabled",
  title = "Options Action Scan",
  showHeaderSummary = true
}: OptionsActionScanReportProps) {
  const queryClient = useQueryClient();
  const [holdingSort, setHoldingSort] = useState<SortState>(defaultSort);
  const [watchlistSort, setWatchlistSort] = useState<SortState>(defaultSort);
  const [createAlertByRowId, setCreateAlertByRowId] = useState<Record<string, boolean>>({});
  const [shareBusy, setShareBusy] = useState(false);
  const [share, setShare] = useState<ShareCreateResponse | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const applyCacheKey = useMemo(
    () => ["options_scan_apply_watchlist", data.generatedAt] as const,
    [data.generatedAt]
  );
  const { data: applyCache = {} } = useQuery<ApplyCacheData>({
    queryKey: applyCacheKey,
    queryFn: async () => ({}),
    initialData: {},
    enabled: false
  });
  const applyToWatchlistMutation = useMutation({
    mutationFn: async (input: {
      row: OptionsActionReportRow;
      createPriceAlert: boolean;
    }): Promise<ApplyWatchlistResponse> => {
      const response = await fetch("/api/reports/scan/apply-watchlist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row: input.row,
          createPriceAlert: input.createPriceAlert
        })
      });
      const payload = (await response.json().catch(() => ({}))) as
        | ApplyWatchlistResponse
        | { error?: string };
      if (!response.ok || !("data" in payload)) {
        throw new Error(
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not apply row to watchlist"
        );
      }
      return payload;
    },
    onMutate(input) {
      queryClient.setQueryData<ApplyCacheData>(applyCacheKey, (previous) => ({
        ...(previous ?? {}),
        [input.row.rowId]: { status: "pending", message: "Applying…" }
      }));
    },
    onSuccess(payload, input) {
      queryClient.setQueryData<ApplyCacheData>(applyCacheKey, (previous) => {
        const createdAlert = payload.data.priceAlert != null;
        return {
          ...(previous ?? {}),
          [input.row.rowId]: {
            status: "success",
            message: createdAlert
              ? "Applied + alert created"
              : payload.data.watchlist.alreadyPresent
                ? "Updated watchlist row"
                : "Added to watchlist"
          }
        };
      });
    },
    onError(error, input) {
      queryClient.setQueryData<ApplyCacheData>(applyCacheKey, (previous) => ({
        ...(previous ?? {}),
        [input.row.rowId]: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not apply row to watchlist"
        }
      }));
    }
  });
  const generatedAtLabel = useMemo(() => new Date(data.generatedAt).toLocaleString(), [data.generatedAt]);
  const holdings = useMemo(
    () => sectionRows(data.rows, "holding", holdingSort),
    [data.rows, holdingSort]
  );
  const watchlist = useMemo(
    () => sectionRows(data.rows, "watchlist", watchlistSort),
    [data.rows, watchlistSort]
  );
  const rowApplyEnabled = shareMode === "enabled";
  const closeCount = useMemo(() => closeRecommendationCount(data.rows), [data.rows]);
  const highConfidenceStc = useMemo(
    () =>
      holdings.find(
        (row) => row.recommendedAction === "STC" && row.confidence === "high"
      )?.symbol ?? holdings.find((row) => row.confidence === "high")?.symbol,
    [holdings]
  );
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

  async function downloadPdfReport() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await exportPolishedPdf(data, title);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Could not generate polished PDF");
      // Fallback to legacy client-side PDF so export still works if Python service is unavailable.
      exportPdf(data);
    } finally {
      setPdfBusy(false);
    }
  }

  function handleApplyToWatchlist(row: OptionsActionReportRow) {
    const createPriceAlert = Boolean(createAlertByRowId[row.rowId]);
    applyToWatchlistMutation.mutate({
      row,
      createPriceAlert
    });
  }

  return (
    <section className="options-action-scan-root mx-auto w-full max-w-[1480px] px-6 py-8">
      <div className="relative isolate overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-[#0F172A]/95">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-slate-100/70 to-transparent dark:from-white/5" />
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 px-8 py-7 dark:border-slate-700/60">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.2px] text-[var(--xf-text-100)]">{title}</h2>
            <div className="text-xs text-slate-400">{generatedAtLabel}</div>
          </div>
          <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium tracking-wider text-emerald-400">
            ADVISOR
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 p-8 text-[14.5px] md:grid-cols-3">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold tracking-[0.5px] text-slate-600 dark:text-slate-300">
                CLOSE CANDIDATES
              </div>
              <div className="rounded bg-slate-700 px-2 py-0.5 font-mono text-[10px]">{closeCount}</div>
            </div>
            <ReportTable
              rows={holdings}
              sort={holdingSort}
              onSortChange={setHoldingSort}
              showBookColumn
              showGenericHelper={false}
              applyEnabled={rowApplyEnabled}
              applyCache={applyCache}
              createAlertByRowId={createAlertByRowId}
              onCreateAlertChange={(rowId, checked) =>
                setCreateAlertByRowId((previous) => ({ ...previous, [rowId]: checked }))
              }
              onApplyToWatchlist={handleApplyToWatchlist}
            />
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold tracking-[0.5px] text-slate-600 dark:text-slate-300">
                WATCHLIST
              </div>
              <div className="rounded bg-slate-700 px-2 py-0.5 font-mono text-[10px]">{watchlist.length}</div>
            </div>
            <ReportTable
              rows={watchlist}
              sort={watchlistSort}
              onSortChange={setWatchlistSort}
              showBookColumn={false}
              showGenericHelper
              applyEnabled={rowApplyEnabled}
              applyCache={applyCache}
              createAlertByRowId={createAlertByRowId}
              onCreateAlertChange={(rowId, checked) =>
                setCreateAlertByRowId((previous) => ({ ...previous, [rowId]: checked }))
              }
              onApplyToWatchlist={handleApplyToWatchlist}
            />
            {genericWatchlistCount > 0 ? (
              <p className="text-xs text-[var(--xf-text-400)]">
                Define entry criteria in xStrategyBuilder for generic monitoring rows.
              </p>
            ) : null}
          </section>

          <aside className="relative space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-950/60 p-5 pl-6 shadow-[0_0_22px_rgba(16,185,129,0.12)]">
            <div className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r bg-emerald-400/65" />
            {showHeaderSummary ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                  <div className="text-[13px] font-semibold tracking-[0.5px] text-emerald-300">CONVICTION</div>
                </div>
                <div className="text-3xl font-semibold tracking-tighter text-emerald-400">
                  {highConfidenceStc ?? "—"}
                </div>
                <div className="text-xs text-emerald-400/80">
                  {highConfidenceStc ? "Highest-confidence lane (STC bias)" : "No HIGH confidence signal yet"}
                </div>
              </>
            ) : null}
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--xf-lightning-yellow)_25%,transparent)] bg-[color-mix(in_srgb,var(--xf-lightning-yellow)_10%,transparent)] px-4 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--xf-text-100)]">
                Key Insights
              </h4>
              <p className="mt-1 text-xs text-[var(--xf-text-200)]">
                {closeCount} close candidates across active holdings, {watchlist.length} watchlist symbols still
                monitoring, and{" "}
                {highConfidenceStc
                  ? `strongest conviction currently ${highConfidenceStc}.`
                  : "no high-confidence conviction ticker yet."}
              </p>
              <p className="mt-1 text-[0.68rem] text-[var(--xf-text-400)]">{data.disclaimer}</p>
            </div>
            {share ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_12%,transparent)] px-2.5 py-2 text-xs">
                <span className="font-medium text-[var(--xf-text-100)]">{share.shareUrl}</span>
                <button
                  className="xchat-scan-action-btn xchat-scan-action-btn--compact xchat-scan-action-btn--neutral"
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
            {pdfError ? (
              <p className="text-xs text-[var(--xf-warning-400)]" role="status">
                Polished report unavailable — downloaded legacy PDF instead. ({pdfError})
              </p>
            ) : null}
          </aside>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/70 bg-slate-50/95 px-8 py-7 dark:border-slate-700/60 dark:bg-[#0B0F14]">
          <button
            className="rounded-lg border border-slate-300 px-5 py-2 text-xs font-medium transition hover:bg-slate-200 dark:border-slate-600 dark:hover:bg-slate-800"
            type="button"
            onClick={() => void downloadPdfReport()}
          >
            {pdfBusy ? "Generating PDF…" : "Download PDF Report"}
          </button>
          <button
            className="rounded-lg border border-slate-300 px-5 py-2 text-xs font-medium transition hover:bg-slate-200 dark:border-slate-600 dark:hover:bg-slate-800"
            type="button"
            onClick={() => exportCsv(data)}
          >
            Export CSV
          </button>
          <div className="flex-1" />
          {shareMode === "enabled" ? (
            <button
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 hover:shadow-md"
              disabled={shareBusy}
              type="button"
              onClick={() => void createShareLink()}
            >
              {shareBusy ? "Creating link…" : "Create Temporary Share Link (24h)"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReportTable(props: {
  rows: OptionsActionReportRow[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  /** Holdings table: show custodian book + link to account workspace. */
  showBookColumn: boolean;
  showGenericHelper: boolean;
  applyEnabled: boolean;
  applyCache: ApplyCacheData;
  createAlertByRowId: Record<string, boolean>;
  onCreateAlertChange: (rowId: string, checked: boolean) => void;
  onApplyToWatchlist: (row: OptionsActionReportRow) => void;
}) {
  const [expandedWhyId, setExpandedWhyId] = useState<string | null>(null);
  const toggleWhy = (rowId: string) => {
    setExpandedWhyId((previous) => (previous === rowId ? null : rowId));
  };

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--xf-radius-sm)] border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_28%,var(--xf-surface-700))] shadow-sm sm:block">
        <table
          className={`w-full border-collapse text-left text-xs ${props.showBookColumn ? "min-w-[58rem]" : "min-w-[52rem]"}`}
        >
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-slate-100/85 dark:bg-slate-900">
              <SortTh label="Instrument" sortKey="symbol" {...props} />
              {props.showBookColumn ? (
                <th className="px-3 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-slate-600 dark:text-slate-400">
                  Book
                </th>
              ) : null}
              <SortTh label="Action" sortKey="action" {...props} />
              <SortTh label="Urgency" sortKey="urgency" {...props} />
              <SortTh label="Confidence" sortKey="confidence" {...props} />
              <SortTh align="right" label="Exp" sortKey="expiry" {...props} />
              <th className="px-3 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-slate-600 dark:text-slate-400">
                Why
              </th>
              <th className="px-3 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-slate-600 dark:text-slate-400">
                Open
              </th>
              <th className="px-3 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-slate-600 dark:text-slate-400">
                Apply
              </th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-4 text-[var(--xf-text-400)]"
                  colSpan={props.showBookColumn ? 9 : 8}
                >
                  No rows.
                </td>
              </tr>
            ) : (
              props.rows.map((row, idx) => {
                const instrument = toRowInstrument(row);
                const generic = !(instrument.strike != null && instrument.exp && instrument.type);
                const isSpecialLunr = Boolean(
                  instrument.symbol === "LUNR" &&
                    instrument.type === "put" &&
                    instrument.exp?.endsWith("-05-01") &&
                    Math.abs((instrument.strike ?? 0) - 27.5) < 0.001
                );
                const rowApplyState = props.applyCache[row.rowId];
                const rowCreateAlert = Boolean(props.createAlertByRowId[row.rowId]);
                const applyPending = rowApplyState?.status === "pending";
                const rowKey = row.rowId || `${row.source}-${row.symbol}-${idx}`;
                const whyExpanded = expandedWhyId === row.rowId;
                return (
                  <tr
                    className="border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--xf-tenant-primary)_8%,var(--xf-surface-700))]"
                    key={rowKey}
                  >
                    <td className="align-top px-3 py-2.5">
                      <InstrumentStack row={row} />
                    </td>
                    {props.showBookColumn ? (
                      <td className="align-top px-3 py-2.5">
                        <BookCell row={row} />
                      </td>
                    ) : null}
                    <td className="align-top px-3 py-2.5">
                      <span className={actionLabelClasses(row.recommendedAction)}>{row.recommendedAction}</span>
                    </td>
                    <td className="align-top px-3 py-2.5">
                      <UrgencyBadge urgency={row.urgency} />
                    </td>
                    <td className="align-top px-3 py-2.5">
                      <ConfidenceBadge confidence={row.confidence} />
                    </td>
                    <td className="align-top px-3 py-2.5">
                      <ExpiryCell exp={instrument.exp} />
                    </td>
                    <td className="align-top px-3 py-2.5">
                      <WhyCell
                        expanded={whyExpanded}
                        generic={generic}
                        isSpecialLunr={isSpecialLunr}
                        showGenericHelper={props.showGenericHelper}
                        text={row.why}
                        onToggle={() => toggleWhy(row.rowId)}
                      />
                    </td>
                    <td className="align-top px-3 py-2.5">
                      <Link
                        className="inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--xf-xoptions-accent)_8%,transparent)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--xf-xoptions-accent)] xf-shadow-hairline-inset hover:bg-[color-mix(in_srgb,var(--xf-xoptions-accent)_16%,transparent)]"
                        href={toXoptionsHref(row)}
                      >
                        Open in xOptions
                      </Link>
                    </td>
                    <td className="align-top px-3 py-2.5">
                      {props.applyEnabled ? (
                        <div className="flex flex-col gap-1">
                          <button
                            className="inline-flex items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_48%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] px-2 py-1 text-[0.65rem] font-bold text-[var(--xf-gain-green)] xf-shadow-hairline-inset-10 hover:bg-[color-mix(in_srgb,var(--xf-gain-green)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={applyPending}
                            type="button"
                            onClick={() => props.onApplyToWatchlist(row)}
                          >
                            {applyPending ? "Applying…" : "Apply to Watchlist"}
                          </button>
                          {row.applyToWatchlist.allowPriceAlert ? (
                            <label className="inline-flex items-center gap-1 text-[0.62rem] text-[var(--xf-text-400)]">
                              <input
                                checked={rowCreateAlert}
                                className="accent-[var(--xf-gain-green)]"
                                disabled={applyPending}
                                type="checkbox"
                                onChange={(event) =>
                                  props.onCreateAlertChange(
                                    row.rowId,
                                    event.currentTarget.checked
                                  )
                                }
                              />
                              Create price alert
                            </label>
                          ) : null}
                          {rowApplyState?.message ? (
                            <span
                              className={
                                rowApplyState.status === "error"
                                  ? "text-[0.62rem] text-[var(--xf-danger-400)]"
                                  : "text-[0.62rem] text-[var(--xf-text-300)]"
                              }
                            >
                              {rowApplyState.message}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[0.62rem] text-[var(--xf-text-500)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:hidden">
        {props.rows.length === 0 ? (
          <p className="text-xs text-[var(--xf-text-400)]">No rows.</p>
        ) : (
          props.rows.map((row, idx) => {
            const instrument = toRowInstrument(row);
            const generic = !(instrument.strike != null && instrument.exp && instrument.type);
            const isSpecialLunr = Boolean(
              instrument.symbol === "LUNR" &&
                instrument.type === "put" &&
                instrument.exp?.endsWith("-05-01") &&
                Math.abs((instrument.strike ?? 0) - 27.5) < 0.001
            );
            const rowApplyState = props.applyCache[row.rowId];
            const rowCreateAlert = Boolean(props.createAlertByRowId[row.rowId]);
            const applyPending = rowApplyState?.status === "pending";
            const whyExpanded = expandedWhyId === row.rowId;
            return (
              <article
                className="rounded-[var(--xf-radius-sm)] border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_5%,var(--xf-surface-700))] p-3 xf-shadow-hairline-inset-6"
                key={row.rowId || `${row.source}-${row.symbol}-mobile-${idx}`}
              >
                <InstrumentStack row={row} />
                {props.showBookColumn && row.portfolioAccountId ? (
                  <div className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_35%,transparent)] px-2 py-1.5">
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--xf-text-500)]">
                      Book
                    </p>
                    <p className="mt-0.5 text-[0.72rem] font-medium text-[var(--xf-text-200)]">
                      {row.portfolioAccountName ?? "Book"}
                    </p>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={actionLabelClasses(row.recommendedAction)}>{row.recommendedAction}</span>
                  <UrgencyBadge urgency={row.urgency} />
                  <ConfidenceBadge confidence={row.confidence} />
                </div>
                <div className="mt-2 flex justify-end">
                  <ExpiryCell exp={instrument.exp} />
                </div>
                <div className="mt-2">
                  <WhyCell
                    expanded={whyExpanded}
                    generic={generic}
                    isSpecialLunr={isSpecialLunr}
                    showGenericHelper={props.showGenericHelper}
                    text={row.why}
                    onToggle={() => toggleWhy(row.rowId)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.showBookColumn && row.portfolioAccountId ? (
                    <Link
                      className="inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_42%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] px-3 py-1 text-xs font-bold text-[var(--xf-gain-green)]"
                      href={toPortfolioAccountHref(row.portfolioAccountId)}
                    >
                      Open book
                    </Link>
                  ) : null}
                  <Link
                    className="inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--xf-xoptions-accent)_8%,transparent)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--xf-xoptions-accent)]"
                    href={toXoptionsHref(row)}
                  >
                    Open in xOptions
                  </Link>
                </div>
                {props.applyEnabled ? (
                  <div className="mt-3 space-y-1">
                    <button
                      className="inline-flex w-full items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_48%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] px-2 py-1.5 text-[0.68rem] font-bold text-[var(--xf-gain-green)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={applyPending}
                      type="button"
                      onClick={() => props.onApplyToWatchlist(row)}
                    >
                      {applyPending ? "Applying…" : "Apply to Watchlist"}
                    </button>
                    {row.applyToWatchlist.allowPriceAlert ? (
                      <label className="inline-flex items-center gap-1 text-[0.62rem] text-[var(--xf-text-400)]">
                        <input
                          checked={rowCreateAlert}
                          className="accent-[var(--xf-gain-green)]"
                          disabled={applyPending}
                          type="checkbox"
                          onChange={(event) =>
                            props.onCreateAlertChange(
                              row.rowId,
                              event.currentTarget.checked
                            )
                          }
                        />
                        Create price alert
                      </label>
                    ) : null}
                    {rowApplyState?.message ? (
                      <p
                        className={
                          rowApplyState.status === "error"
                            ? "text-[0.62rem] text-[var(--xf-danger-400)]"
                            : "text-[0.62rem] text-[var(--xf-text-300)]"
                        }
                      >
                        {rowApplyState.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </>
  );
}

export function OptionsActionScanReport(props: OptionsActionScanReportProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: 10 * 60 * 1000
          }
        }
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <OptionsActionScanReportInner {...props} />
    </QueryClientProvider>
  );
}

function SortTh(props: {
  label: string;
  sortKey: SortKey;
  align?: "left" | "right";
  rows: OptionsActionReportRow[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  showGenericHelper: boolean;
}) {
  const isActive = props.sort.key === props.sortKey;
  const align = props.align ?? "left";
  return (
    <th className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        className={[
          "inline-flex max-w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 shadow-none outline-none",
          "appearance-none [-webkit-appearance:none]",
          "text-[0.62rem] font-semibold uppercase tracking-[0.09em] text-slate-600 dark:text-slate-400",
          "hover:bg-transparent hover:text-[var(--xf-text-300)]",
          "focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--xf-tenant-primary)_45%,transparent)] focus-visible:ring-offset-0",
          align === "right" ? "ml-auto justify-end text-right" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => props.onSortChange(sortToggle(props.sort, props.sortKey))}
      >
        {props.label}
        <span className="text-[0.58rem] opacity-80">{isActive ? (props.sort.dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}
