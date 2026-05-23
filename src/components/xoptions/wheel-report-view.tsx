"use client";

import type { ApexOptions } from "apexcharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dynamic from "next/dynamic";
import { useId, useMemo, useState } from "react";

import { resolveDesignTokenColor } from "@/lib/resolve-design-token-color";
import { yieldPerCyclePctOfCapital } from "@/modules/xoptions/wheel-metrics";
import type { WheelGeneratedPayload, WheelIdea } from "@/modules/xoptions/wheel-types";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type ShareResponse = {
  shareUrl: string;
  expiresAt: string;
  expiresIn: string;
};

type WheelReportViewProps = {
  report: WheelGeneratedPayload;
  generatedByName: string;
  shareEnabled?: boolean;
  showPdfButton?: boolean;
  onEdit?: () => void;
};

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export type WheelPdfChartAssets = {
  assignmentProbabilitiesChartPng?: string | null;
  incomeYieldChartPng?: string | null;
};

async function captureApexChartDataUri(chartId: string): Promise<string | null> {
  try {
    const ApexCharts = (await import("apexcharts")).default;
    const out = (await ApexCharts.exec(chartId, "dataURI", { scale: 2 })) as { imgURI?: string } | undefined;
    return typeof out?.imgURI === "string" ? out.imgURI : null;
  } catch {
    return null;
  }
}

function exportWheelPdf(
  report: WheelGeneratedPayload,
  generatedByName: string,
  charts?: WheelPdfChartAssets
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 42;
  const contentW = pageW - margin * 2;
  const chartImgH = 148;
  const generatedLabel = new Date(report.generatedAtIso).toLocaleString();
  doc.setFillColor(7, 23, 16);
  doc.rect(0, 0, 612, 72, "F");
  doc.setTextColor(189, 255, 77);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("aTx Advisor - Wheel Strategy Professional Report", 42, 42);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`Prepared for ${generatedByName} | Report ID ${report.generatedAtIso.slice(0, 19)}`, 42, 58);

  doc.setTextColor(14, 23, 42);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", 42, 96);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(report.executiveSummary, 42, 114, { maxWidth: 528 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Root Stock Snapshot", 42, 150);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${report.rootSnapshot.ticker} spot ${currency(report.rootSnapshot.spotPrice)} | IV rank ${
      report.rootSnapshot.ivRankPercent == null ? "n/a" : percent(report.rootSnapshot.ivRankPercent, 0)
    } | Earnings ${report.rootSnapshot.earningsDateIso ? new Date(report.rootSnapshot.earningsDateIso).toLocaleDateString() : "not scheduled"}`,
    42,
    166,
    { maxWidth: 528 }
  );

  let tableStartY = 186;
  if (charts?.assignmentProbabilitiesChartPng || charts?.incomeYieldChartPng) {
    tableStartY = 194;
    if (charts.assignmentProbabilitiesChartPng) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(14, 23, 42);
      doc.text("Risk & probability analysis (scenario comparison)", margin, tableStartY);
      tableStartY += 14;
      doc.addImage(charts.assignmentProbabilitiesChartPng, "PNG", margin, tableStartY, contentW, chartImgH);
      tableStartY += chartImgH + 14;
    }
    if (charts.incomeYieldChartPng) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Income & yield by scenario", margin, tableStartY);
      tableStartY += 14;
      doc.addImage(charts.incomeYieldChartPng, "PNG", margin, tableStartY, contentW, chartImgH);
      tableStartY += chartImgH + 18;
    }
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [["Idea", "Capital", "Income / cycle", "Cycle yield", "Annualized", "Assign %", "Call-away %"]],
    body: report.ideas.map((idea) => [
      idea.headline,
      currency(idea.requiredCapitalUsd),
      currency(idea.premiumIncomePerCycleUsd),
      percent(yieldPerCyclePctOfCapital(idea)),
      percent(idea.annualizedYieldPct),
      percent(idea.assignmentProbabilityPct),
      percent(idea.callAwayProbabilityPct)
    ]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: [241, 245, 249], fontSize: 9 },
    styles: { fontSize: 8, overflow: "linebreak" }
  });

  const yAfterIdeas = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 360) + 16;
  autoTable(doc, {
    startY: yAfterIdeas,
    head: [["Detailed Cycle Breakdown + Income Projection"]],
    body: report.ideas.map((idea) => [
      `${idea.headline}\n${idea.cycleBreakdown.map((line) => `- ${line}`).join("\n")}\nIncome / cycle: ${currency(idea.premiumIncomePerCycleUsd)} | Cycle yield: ${percent(yieldPerCyclePctOfCapital(idea))} | Annualized: ${percent(idea.annualizedYieldPct)}`
    ]),
    theme: "plain",
    headStyles: { fillColor: [22, 101, 52], textColor: [240, 253, 244], fontSize: 10 },
    styles: { fontSize: 8, cellPadding: 6 }
  });

  const yAfterBreakdown = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 620) + 12;
  autoTable(doc, {
    startY: yAfterBreakdown,
    head: [["Related Supplier Candidates (ranked)", "Relationship", "Avg IV", "Est. Wheel Yield"]],
    body: report.relatedSuppliers.topCandidates.map((supplier) => [
      `${supplier.symbol} (${supplier.companyName})`,
      supplier.relationship,
      `${supplier.avgImpliedVolatilityPct.toFixed(1)}%`,
      `${supplier.estimatedWheelYieldPct.toFixed(1)}%`
    ]),
    theme: "striped",
    headStyles: { fillColor: [2, 44, 34], textColor: [236, 253, 245], fontSize: 9 },
    styles: { fontSize: 8, overflow: "linebreak" }
  });

  const footerY = Math.min(
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 700) + 18,
    744
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated ${generatedLabel}`, 42, footerY);
  doc.text(report.disclaimer, 42, footerY + 12, { maxWidth: 528 });
  doc.save(`wheel-strategy-report-${report.rootSnapshot.ticker}-${report.generatedAtIso.slice(0, 10)}.pdf`);
}

function bestIdea(ideas: WheelIdea[]): WheelIdea {
  return ideas.reduce((best, next) =>
    next.annualizedYieldPct > best.annualizedYieldPct ? next : best
  );
}

export function WheelReportView({
  report,
  generatedByName,
  shareEnabled = true,
  showPdfButton = true,
  onEdit
}: WheelReportViewProps) {
  const chartIdSuffix = useId().replace(/:/g, "");
  const wheelProbChartId = `wheel-pdf-prob-${chartIdSuffix}`;
  const wheelYieldChartId = `wheel-pdf-yield-${chartIdSuffix}`;

  const [activeIdeaId, setActiveIdeaId] = useState(report.ideas[0]?.ideaId ?? "");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<ShareResponse | null>(null);
  const [relatedWlBusy, setRelatedWlBusy] = useState(false);
  const [relatedWlMsg, setRelatedWlMsg] = useState<string | null>(null);
  const [relatedWlErr, setRelatedWlErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const selectedIdea = useMemo(
    () => report.ideas.find((idea) => idea.ideaId === activeIdeaId) ?? bestIdea(report.ideas),
    [activeIdeaId, report.ideas]
  );

  const chartSeries = useMemo(
    () => [
      {
        name: "Assignment probability",
        data: report.ideas.map((idea) => roundPercent(idea.assignmentProbabilityPct))
      },
      {
        name: "Call-away probability",
        data: report.ideas.map((idea) => roundPercent(idea.callAwayProbabilityPct))
      }
    ],
    [report.ideas]
  );

  const chartSeriesYield = useMemo(
    () => [
      {
        name: "Annualized yield (proj.)",
        data: report.ideas.map((idea) => roundPercent(idea.annualizedYieldPct))
      },
      {
        name: "Yield / cycle (% of capital)",
        data: report.ideas.map((idea) => roundPercent(yieldPerCyclePctOfCapital(idea)))
      }
    ],
    [report.ideas]
  );

  const chartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: wheelProbChartId,
        type: "bar",
        background: resolveDesignTokenColor("--xf-bg-900", "background", "rgb(15, 23, 42)"),
        toolbar: { show: false },
        fontFamily: "var(--xf-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)"
      },
      plotOptions: {
        bar: { horizontal: false, columnWidth: "50%" }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: report.ideas.map((idea) => idea.headline.replace(`${report.rootSnapshot.ticker} `, "")),
        labels: { style: { colors: "rgb(148,163,184)", fontSize: "10px" } }
      },
      yaxis: {
        max: 100,
        labels: {
          formatter: (value: number) => `${Math.round(value)}%`,
          style: { colors: "rgb(148,163,184)" }
        }
      },
      legend: { labels: { colors: "rgb(226,232,240)" } },
      grid: { borderColor: "rgba(148,163,184,0.22)" },
      colors: ["#22c55e", "#e11d48"],
      tooltip: {
        y: { formatter: (value: number) => `${value.toFixed(1)}%` }
      }
    }),
    [report.ideas, report.rootSnapshot.ticker, wheelProbChartId]
  );

  const chartOptionsYield = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: wheelYieldChartId,
        type: "bar",
        background: resolveDesignTokenColor("--xf-bg-900", "background", "rgb(15, 23, 42)"),
        toolbar: { show: false },
        fontFamily: "var(--xf-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)"
      },
      plotOptions: {
        bar: { horizontal: false, columnWidth: "55%" }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: report.ideas.map((idea) => idea.headline.replace(`${report.rootSnapshot.ticker} `, "")),
        labels: { style: { colors: "rgb(148,163,184)", fontSize: "10px" } }
      },
      yaxis: [
        {
          seriesName: "Annualized yield (proj.)",
          labels: {
            formatter: (value: number) => `${value.toFixed(0)}%`,
            style: { colors: "rgb(148,163,184)" }
          },
          title: {
            text: "Annualized %",
            style: { color: "rgb(148,163,184)", fontSize: "10px", fontWeight: 500 }
          }
        },
        {
          opposite: true,
          seriesName: "Yield / cycle (% of capital)",
          labels: {
            formatter: (value: number) => `${value.toFixed(1)}%`,
            style: { colors: "rgb(148,163,184)" }
          },
          title: {
            text: "Cycle yield %",
            style: { color: "rgb(148,163,184)", fontSize: "10px", fontWeight: 500 }
          }
        }
      ],
      legend: { labels: { colors: "rgb(226,232,240)" } },
      grid: { borderColor: "rgba(148,163,184,0.22)" },
      colors: ["#22c55e", "#38bdf8"],
      tooltip: {
        y: { formatter: (value: number) => `${value.toFixed(1)}%` }
      }
    }),
    [report.ideas, report.rootSnapshot.ticker, wheelYieldChartId]
  );

  async function handleGenerateProfessionalPdf(): Promise<void> {
    setPdfBusy(true);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const [assignmentProbabilitiesChartPng, incomeYieldChartPng] = await Promise.all([
        captureApexChartDataUri(wheelProbChartId),
        captureApexChartDataUri(wheelYieldChartId)
      ]);
      exportWheelPdf(report, generatedByName, {
        assignmentProbabilitiesChartPng,
        incomeYieldChartPng
      });
    } finally {
      setPdfBusy(false);
    }
  }

  async function createShareLink() {
    setShareBusy(true);
    setShareError(null);
    try {
      const response = await fetch("/api/reports/wheel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: ShareResponse;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not create wheel share link");
      }
      setShareData(payload.data);
      await navigator.clipboard.writeText(payload.data.shareUrl).catch(() => {});
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not create wheel share link");
    } finally {
      setShareBusy(false);
    }
  }

  async function addRelatedSuppliersToWatchlist(): Promise<void> {
    setRelatedWlBusy(true);
    setRelatedWlErr(null);
    setRelatedWlMsg(null);
    try {
      const root = report.relatedSuppliers.rootTicker.trim().toUpperCase();
      const symbols = [
        ...new Set(
          report.relatedSuppliers.topCandidates
            .map((c) => c.symbol.trim().toUpperCase())
            .filter((s) => /^[A-Z0-9.\-]{1,32}$/.test(s))
            .filter((s) => s !== root)
        )
      ];
      if (symbols.length === 0) {
        setRelatedWlErr("No symbols to add.");
        return;
      }
      const response = await fetch("/api/reports/wheel/apply-watchlist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootTicker: report.relatedSuppliers.rootTicker,
          symbols,
          generatedAtIso: report.generatedAtIso
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: {
          addedNew: number;
          mergedExisting: number;
          watchlistSymbolCount: number;
        };
      };
      if (!response.ok || !payload.data) {
        if (response.status === 401) {
          throw new Error("Sign in to add related supplier symbols to your watchlist.");
        }
        throw new Error(payload.error ?? "Could not update watchlist");
      }
      const { addedNew, mergedExisting, watchlistSymbolCount } = payload.data;
      setRelatedWlMsg(
        `Added ${addedNew} new watchlist row(s); updated ${mergedExisting} existing row(s). Total symbols: ${watchlistSymbolCount}.`
      );
    } catch (error) {
      setRelatedWlErr(error instanceof Error ? error.message : "Could not update watchlist");
    } finally {
      setRelatedWlBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-gain-green)_26%,transparent)] bg-[var(--xf-surface-700)] p-4 sm:p-5">
      <header className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_15%,transparent)] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--xf-text-100)]">Wheel Strategy Professional Report</h2>
          <span className="rounded-full border border-[color-mix(in_srgb,var(--xf-lightning-yellow)_34%,transparent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--xf-lightning-yellow)]">
            {new Date(report.generatedAtIso).toLocaleString()}
          </span>
          <span className="rounded-full border border-[color-mix(in_srgb,var(--xf-gain-green)_34%,transparent)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--xf-gain-green)]">
            Prepared for {generatedByName}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--xf-text-200)]">{report.executiveSummary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {showPdfButton ? (
            <button
              className="xchat-scan-action-btn xchat-scan-action-btn--accent"
              type="button"
              disabled={pdfBusy}
              onClick={() => void handleGenerateProfessionalPdf()}
            >
              {pdfBusy ? "Generating PDF…" : "Generate Professional PDF"}
            </button>
          ) : null}
          {shareEnabled ? (
            <button
              className="xchat-scan-action-btn xchat-scan-action-btn--gain"
              disabled={shareBusy}
              type="button"
              onClick={() => void createShareLink()}
            >
              {shareBusy ? "Creating link..." : "Create Temporary Share Link (24h)"}
            </button>
          ) : null}
          {onEdit ? (
            <button className="xchat-scan-action-btn xchat-scan-action-btn--neutral" type="button" onClick={onEdit}>
              Edit Parameters & Regenerate
            </button>
          ) : null}
        </div>
        {shareData ? (
          <p className="mt-2 text-xs text-[var(--xf-text-300)]">
            Share link copied: <span className="font-semibold text-[var(--xf-text-100)]">{shareData.shareUrl}</span>{" "}
            (expires {new Date(shareData.expiresAt).toLocaleString()})
          </p>
        ) : null}
        {shareError ? (
          <p className="mt-2 text-xs text-[var(--xf-danger-400)]" role="alert">
            {shareError}
          </p>
        ) : null}
      </header>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Kpi label="Root Stock Spot" value={currency(report.rootSnapshot.spotPrice)} />
        <Kpi
          label="IV Rank"
          value={report.rootSnapshot.ivRankPercent == null ? "n/a" : percent(report.rootSnapshot.ivRankPercent, 0)}
        />
        <Kpi label="Best Cycle Income" value={currency(bestIdea(report.ideas).premiumIncomePerCycleUsd)} />
        <Kpi label="Best Annualized Yield" value={percent(bestIdea(report.ideas).annualizedYieldPct)} />
      </div>

      <section className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_45%,transparent)] p-3">
        <h3 className="text-sm font-semibold text-[var(--xf-text-100)]">Recommended Wheel Ideas</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {report.ideas.map((idea) => {
            const active = selectedIdea.ideaId === idea.ideaId;
            return (
              <button
                key={idea.ideaId}
                className={`rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-[var(--xf-accent-cta)] bg-[color-mix(in_srgb,var(--xf-accent-cta)_14%,transparent)]"
                    : "border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)]"
                }`}
                type="button"
                onClick={() => setActiveIdeaId(idea.ideaId)}
              >
                <p className="text-sm font-semibold text-[var(--xf-text-100)]">{idea.headline}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[0.7rem] leading-snug">
                  <span className="text-[var(--xf-text-400)]">Income / cycle</span>
                  <span className="text-right font-semibold text-[var(--xf-accent-cta)]">
                    {currency(idea.premiumIncomePerCycleUsd)}
                  </span>
                  <span className="text-[var(--xf-text-400)]">Cycle yield</span>
                  <span className="text-right font-semibold text-[var(--xf-text-100)]">
                    {percent(yieldPerCyclePctOfCapital(idea))}
                  </span>
                  <span className="text-[var(--xf-text-400)]">Annualized</span>
                  <span className="text-right font-semibold text-[var(--xf-lightning-yellow)]">
                    {percent(idea.annualizedYieldPct)}
                  </span>
                  <span className="col-span-2 mt-0.5 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-1 text-[var(--xf-text-400)]">
                    Capital{" "}
                    <strong className="font-semibold text-[var(--xf-text-100)]">{currency(idea.requiredCapitalUsd)}</strong>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)] p-3">
          <h3 className="text-sm font-semibold text-[var(--xf-text-100)]">Detailed Cycle Breakdown</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--xf-text-200)]">
            {selectedIdea.cycleBreakdown.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--xf-text-300)]">{selectedIdea.whyThisWorks}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <StatRow label="Put Leg" value={`${selectedIdea.putLeg.strike.toFixed(2)} @ ${selectedIdea.putLeg.expiration}`} />
            <StatRow label="Call Leg" value={`${selectedIdea.callLeg.strike.toFixed(2)} @ ${selectedIdea.callLeg.expiration}`} />
            <StatRow label="Assignment Probability" value={percent(selectedIdea.assignmentProbabilityPct)} />
            <StatRow label="Call-away Probability" value={percent(selectedIdea.callAwayProbabilityPct)} />
            <StatRow label="Max Capital At Risk" value={currency(selectedIdea.maxCapitalAtRiskUsd)} />
            <StatRow label="Income per Cycle" value={currency(selectedIdea.premiumIncomePerCycleUsd)} />
            <StatRow label="Yield per Cycle (% of capital)" value={percent(yieldPerCyclePctOfCapital(selectedIdea))} />
            <StatRow label="Projected Annualized Yield" value={percent(selectedIdea.annualizedYieldPct)} />
          </div>
        </article>

        <article className="rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)] p-3">
          <h3 className="text-sm font-semibold text-[var(--xf-text-100)]">Risk & Probability Analysis</h3>
          <div className="mt-2">
            <ReactApexChart options={chartOptions} series={chartSeries} type="bar" height={240} />
          </div>
          <div className="mt-3 rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-2 text-xs">
            <p className="text-[var(--xf-text-200)]">
              Portfolio fit:{" "}
              <strong className="font-semibold text-[var(--xf-text-100)]">{report.portfolioFit.fitLabel.replace("_", " ")}</strong>
            </p>
            <p className="mt-1 text-[var(--xf-text-300)]">{report.portfolioFit.note}</p>
            <p className="mt-1 text-[var(--xf-text-300)]">
              Projected allocation <strong className="font-semibold text-[var(--xf-text-100)]">{percent(report.portfolioFit.projectedAllocationPct)}</strong>
            </p>
          </div>
        </article>
      </section>

      <section className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--xf-gain-green)_20%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_35%,transparent)] p-3">
        <h3 className="text-sm font-semibold text-[var(--xf-text-100)]">Income & yield by scenario</h3>
        <p className="mt-1 text-[0.65rem] text-[var(--xf-text-400)]">
          Cycle yield is premium per full wheel cycle versus put collateral; annualized scales by days to expiry.
        </p>
        <div className="mt-2 max-w-4xl">
          <ReactApexChart options={chartOptionsYield} series={chartSeriesYield} type="bar" height={240} />
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--xf-gain-green)_24%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_8%,transparent)] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
          <h3 className="text-sm font-semibold text-[var(--xf-text-100)]">
            {`Top ${report.relatedSuppliers.topCandidates.length} of ${report.relatedSuppliers.universeScanned} Related Supplier Wheel Candidates`}
          </h3>
          <button
            className="xchat-scan-action-btn xchat-scan-action-btn--gain shrink-0"
            disabled={relatedWlBusy || report.relatedSuppliers.topCandidates.length === 0}
            type="button"
            onClick={() => void addRelatedSuppliersToWatchlist()}
          >
            {relatedWlBusy ? "Adding…" : "Add all to watchlist"}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--xf-text-300)]">{report.relatedSuppliers.selectionRule}</p>
        {relatedWlMsg ? (
          <p className="mt-2 text-xs text-[var(--xf-gain-green)]" role="status">
            {relatedWlMsg}
          </p>
        ) : null}
        {relatedWlErr ? (
          <p className="mt-2 text-xs text-[var(--xf-danger-400)]" role="alert">
            {relatedWlErr}
          </p>
        ) : null}
        <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {report.relatedSuppliers.topCandidates.map((supplier) => (
            <article
              className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-2.5"
              key={supplier.symbol}
            >
              <p className="text-sm font-semibold text-[var(--xf-text-100)]">
                {supplier.symbol}{" "}
                <span className="text-[0.68rem] font-normal text-[var(--xf-text-400)]">{supplier.companyName}</span>
              </p>
              <p className="mt-1 text-[0.7rem] text-[var(--xf-text-300)]">{supplier.relationship}</p>
              <p className="mt-1 text-xs text-[var(--xf-text-200)]">
                Avg IV <strong className="font-semibold text-[var(--xf-gain-green)]">{percent(supplier.avgImpliedVolatilityPct)}</strong>
              </p>
              <p className="text-xs text-[var(--xf-text-200)]">
                Est. wheel yield{" "}
                <strong className="font-semibold text-[var(--xf-gain-green)]">{percent(supplier.estimatedWheelYieldPct)}</strong>
              </p>
              <p className="text-[0.68rem] text-[var(--xf-text-400)]">{supplier.rationale}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-4 rounded-md border border-[color-mix(in_srgb,var(--xf-warning-400)_22%,transparent)] bg-[color-mix(in_srgb,var(--xf-warning-400)_10%,transparent)] p-2 text-[0.72rem] text-[var(--xf-text-200)]">
        {report.disclaimer}
      </footer>
    </section>
  );
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function Kpi(props: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_15%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3">
      <p className="text-[0.64rem] uppercase tracking-[0.08em] text-[var(--xf-text-400)]">{props.label}</p>
      <p className="mt-1 text-base font-black text-[var(--xf-text-100)]">{props.value}</p>
    </article>
  );
}

function StatRow(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_3%,transparent)] px-2 py-1.5">
      <p className="text-[0.62rem] uppercase tracking-[0.08em] text-[var(--xf-text-400)]">{props.label}</p>
      <p className="text-xs font-semibold text-[var(--xf-text-100)]">{props.value}</p>
    </div>
  );
}
