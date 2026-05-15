"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    QuantTraderDistributionChart,
    type QuantTraderDistributionChartHandle,
    type QuantTraderDistributionPoint
} from "@/app/xoptions/ui/quant-trader-distribution-chart";
import { XoptionsContractPayoffChart } from "@/app/xoptions/xoptions-contract-payoff-chart";
import { writeXchatPendingComposerHandoff } from "@/lib/xchat/xchat-pending-prompt";
import {
    buildQuantTraderExportMeta,
    buildQuantTraderXchatPrompt,
    estimateProbProfitPct,
    formatQuantTraderParamsSummary,
    mcTierLabel,
    QUANT_TRADER_DEFAULT_PARAMS,
    quantTraderExportFilenameStem,
    quantTraderResultsToCsvWithMeta,
    type QuantTraderRunParams
} from "@/lib/xoptions/quant-trader-helpers";
import type { McRiskTolerance } from "@/modules/strategy-options/monte-carlo-tail-risk";
import type {
    GreeksExposureRow,
    MonteCarloTailRiskToolSuccess
} from "@/modules/xchat/monte-carlo-tail-risk-tool";

type QuantTraderContextPayload = {
  workspacePortfolioId: string;
  workspacePortfolioName: string;
  ownedPortfolioCount: number;
  deskRiskProfile: "conservative" | "balanced" | "growth" | null;
  deskOutlook: string | null;
  hotWatchlistSymbols: string[];
  defaultParams: QuantTraderRunParams;
};

type Props = {
  symbol?: string | null;
  strategyLabel?: string | null;
  /** Selected contract context for payoff overlay (optional). */
  payoffOverlay?: {
    side: "call" | "put";
    strike: number;
    premium: number;
    spot: number;
    ivPercent: number | null;
    expirationYyyyMmDd: string;
  } | null;
  compact?: boolean;
};

function greekHeatClass(value: number, kind: "delta" | "theta"): string {
  if (!Number.isFinite(value)) {
    return "quant-trader-greek--neutral";
  }
  if (kind === "theta") {
    return value < 0 ? "quant-trader-greek--neg" : "quant-trader-greek--pos";
  }
  return value < 0 ? "quant-trader-greek--neg" : "quant-trader-greek--pos";
}

function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function QuantTraderPanel({ symbol, strategyLabel, payoffOverlay, compact = false }: Props) {
  const [context, setContext] = useState<QuantTraderContextPayload | null>(null);
  const [params, setParams] = useState<QuantTraderRunParams>(QUANT_TRADER_DEFAULT_PARAMS);
  const [result, setResult] = useState<MonteCarloTailRiskToolSuccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const autoRan = useRef(false);
  const chartRef = useRef<QuantTraderDistributionChartHandle>(null);

  const effectiveParams = useMemo(
    (): QuantTraderRunParams => ({
      ...params,
      strategyLabel: strategyLabel ?? params.strategyLabel,
      symbol: symbol ?? params.symbol
    }),
    [params, strategyLabel, symbol]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app-user/xoptions/quant-trader/context");
        const json = (await res.json()) as { data?: QuantTraderContextPayload };
        if (!cancelled && json.data) {
          setContext(json.data);
          setParams((prev) => ({
            ...prev,
            ...json.data!.defaultParams,
            strategyLabel: strategyLabel ?? prev.strategyLabel,
            symbol: symbol ?? prev.symbol
          }));
        }
      } catch {
        if (!cancelled) {
          setError("Could not load workspace quant context.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [strategyLabel, symbol]);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/app-user/xoptions/quant-trader/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horizonDays: params.horizonDays,
          minIvRankPct: params.minIvRankPct,
          maxDrawdownPct: params.maxDrawdownPct,
          pathCount: params.pathCount,
          risk: params.risk,
          perPortfolioRisk: params.perPortfolioRisk,
          portfolioScope: params.portfolioScope
        })
      });
      const json = (await res.json()) as {
        data?: MonteCarloTailRiskToolSuccess;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setResult(null);
        setError(json.message ?? "Simulation failed.");
        return;
      }
      setResult(json.data ?? null);
    } catch {
      setError("Simulation request failed. Check connection and retry.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    if (autoRan.current || !context) {
      return;
    }
    autoRan.current = true;
    void runSimulation();
  }, [context, runSimulation]);

  const chartSeries: QuantTraderDistributionPoint[] = useMemo(() => {
    if (!result) {
      return [];
    }
    const rows: QuantTraderDistributionPoint[] = result.portfolios
      .filter((p) => p.tailRisk)
      .map((p) => ({
        label: p.portfolioName.slice(0, 12),
        var1dPct: p.tailRisk!.var1dPct95,
        cvar1dPct: p.tailRisk!.cvar1dPct95,
        probDrawdownGt20Pct: p.tailRisk!.probDrawdownGt20Pct
      }));
    if (result.combinedTailRisk) {
      rows.push({
        label: "Combined",
        var1dPct: result.combinedTailRisk.var1dPct95,
        cvar1dPct: result.combinedTailRisk.cvar1dPct95,
        probDrawdownGt20Pct: result.combinedTailRisk.probDrawdownGt20Pct
      });
    }
    return rows;
  }, [result]);

  const greeksRows: GreeksExposureRow[] = useMemo(() => {
    if (!result) {
      return [];
    }
    return result.portfolios.flatMap((p) => p.greeksExposure).slice(0, 12);
  }, [result]);

  const buildExportMeta = useCallback(
    (generatedAt = new Date()) =>
      buildQuantTraderExportMeta({
        params: effectiveParams,
        generatedAt,
        workspacePortfolioName: context?.workspacePortfolioName ?? null,
        simulationGeneratedAt: result?.generatedAt ?? null
      }),
    [context?.workspacePortfolioName, effectiveParams, result?.generatedAt]
  );

  const exportCsv = useCallback(() => {
    if (!result) {
      return;
    }
    const exportedAt = new Date();
    const meta = buildExportMeta(exportedAt);
    const blob = new Blob([quantTraderResultsToCsvWithMeta(result, meta)], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quantTraderExportFilenameStem(exportedAt)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildExportMeta, result]);

  const exportPdf = useCallback(async () => {
    if (!result) {
      return;
    }
    const exportedAt = new Date();
    const meta = buildExportMeta(exportedAt);
    const chartUri = await chartRef.current?.captureDataUri();

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(7, 23, 16);
    doc.rect(0, 0, pageW, 72, "F");
    doc.setTextColor(189, 255, 77);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("xFinance Quant Trader — Monte Carlo Summary", 42, 40);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`/xoptions/quant-trader · exported ${meta.generatedAtLocal}`, 42, 58);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text("Report parameters", 42, 92);
    doc.setFontSize(9);
    const paramLines = [
      formatQuantTraderParamsSummary(meta.params),
      `Monte Carlo paths: ${meta.params.pathCount.toLocaleString()}`,
      `Risk outlook: ${meta.params.perPortfolioRisk ? "Per portfolio (desk profile)" : mcTierLabel(meta.params.risk)}`,
      `Portfolio scope: ${meta.params.portfolioScope === "all" ? "All owned portfolios" : "Workspace active portfolio"}`,
      ...(context?.workspacePortfolioName
        ? [`Active workspace portfolio: ${context.workspacePortfolioName}`]
        : []),
      `Simulation generated (UTC): ${meta.simulationGeneratedAt ?? result.generatedAt}`,
      `Report exported (UTC): ${meta.generatedAtUtc}`
    ];
    let y = 108;
    for (const line of paramLines) {
      doc.text(line, 42, y, { maxWidth: pageW - 84 });
      y += 14;
    }

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Tail-risk distribution", 42, y);
    y += 12;

    if (chartUri) {
      const chartW = pageW - 84;
      const chartH = 170;
      doc.addImage(chartUri, "PNG", 42, y, chartW, chartH);
      y += chartH + 16;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Chart unavailable — re-run simulation and export again.", 42, y);
      y += 20;
    }

    autoTable(doc, {
      startY: y,
      head: [["Portfolio", "VaR 1D", "CVaR 1D", "P(DD>20%)", "Gate"]],
      body: result.portfolios.map((p) => [
        p.portfolioName,
        p.tailRisk ? `${p.tailRisk.var1dPct95.toFixed(1)}%` : "—",
        p.tailRisk ? `${p.tailRisk.cvar1dPct95.toFixed(1)}%` : "—",
        p.tailRisk ? `${(p.tailRisk.probDrawdownGt20Pct * 100).toFixed(1)}%` : "—",
        p.drawdownGate ? (p.drawdownGate.passed ? "Pass" : "Review") : "—"
      ])
    });

    const tableEndY =
      (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 40;

    if (result.combinedTailRisk) {
      const combinedY = tableEndY + 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Combined book (weighted)", 42, combinedY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `1D VaR ${result.combinedTailRisk.var1dPct95.toFixed(1)}% · CVaR ${result.combinedTailRisk.cvar1dPct95.toFixed(1)}% · P(DD>20%) ${(result.combinedTailRisk.probDrawdownGt20Pct * 100).toFixed(1)}%`,
        42,
        combinedY + 14,
        { maxWidth: pageW - 84 }
      );
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Not investment advice. Simulations are model-based estimates. ${result.disclaimer}`,
      42,
      doc.internal.pageSize.getHeight() - 24,
      { maxWidth: pageW - 84 }
    );
    doc.save(`${quantTraderExportFilenameStem(exportedAt)}.pdf`);
  }, [buildExportMeta, context?.workspacePortfolioName, result]);

  const sendToXchat = useCallback(() => {
    const prompt = buildQuantTraderXchatPrompt({
      ...params,
      strategyLabel: strategyLabel ?? params.strategyLabel,
      symbol: symbol ?? params.symbol
    });
    writeXchatPendingComposerHandoff({ prompt, personaName: "quant-trader" });
    window.location.href = "/xchat";
  }, [params, strategyLabel, symbol]);

  const saveStrategyJob = useCallback(async () => {
    setBusyAction("job");
    try {
      const res = await fetch("/api/strategy-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `quant-mc-${Date.now()}`
        },
        body: JSON.stringify({ jobType: "monte-carlo-run" })
      });
      const json = (await res.json()) as { data?: { jobId?: string }; error?: string; message?: string };
      if (!res.ok) {
        setError(json.message ?? "Could not create strategy job.");
        return;
      }
      const jobId = json.data?.jobId;
      if (jobId && result) {
        const summary = buildQuantTraderXchatPrompt({
          ...params,
          strategyLabel: strategyLabel ?? params.strategyLabel,
          symbol: symbol ?? params.symbol
        });
        await fetch(`/api/strategy-jobs/${encodeURIComponent(jobId)}/turns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: summary.slice(0, 2000) })
        }).catch(() => {});
      }
      window.location.href = "/xoptions?strategyJobs=1";
    } catch {
      setError("Strategy job handoff failed.");
    } finally {
      setBusyAction(null);
    }
  }, [params, result, strategyLabel, symbol]);

  const combinedProbProfit = estimateProbProfitPct(result?.combinedTailRisk ?? null);

  return (
    <div className={`quant-trader-panel${compact ? " quant-trader-panel--compact" : ""}`}>
      <div className="quant-trader-panel__header">
        <div>
          <h3 className="quant-trader-panel__title">Quant Trader</h3>
          <p className="quant-trader-panel__sub">
            {context
              ? `${context.ownedPortfolioCount} portfolio(s) · active ${context.workspacePortfolioName}`
              : "Loading workspace…"}
          </p>
        </div>
        <button
          type="button"
          className="xoptions-contract__chain-greeks-toggle"
          disabled={loading}
          onClick={() => void runSimulation()}
        >
          {loading ? "Running…" : "Re-run"}
        </button>
      </div>

      <div className="quant-trader-panel__form grid gap-2 sm:grid-cols-2">
        <label className="quant-trader-field">
          <span>Horizon (days)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={params.horizonDays}
            onChange={(e) =>
              setParams((p) => ({ ...p, horizonDays: Number.parseInt(e.target.value, 10) || 45 }))
            }
          />
        </label>
        <label className="quant-trader-field">
          <span>IV rank min (%)</span>
          <input
            type="number"
            min={1}
            max={99}
            value={params.minIvRankPct}
            onChange={(e) =>
              setParams((p) => ({ ...p, minIvRankPct: Number.parseInt(e.target.value, 10) || 60 }))
            }
          />
        </label>
        <label className="quant-trader-field">
          <span>Max drawdown (%)</span>
          <input
            type="number"
            min={1}
            max={99}
            value={params.maxDrawdownPct}
            onChange={(e) =>
              setParams((p) => ({
                ...p,
                maxDrawdownPct: Number.parseInt(e.target.value, 10) || 15
              }))
            }
          />
        </label>
        <label className="quant-trader-field">
          <span>Paths</span>
          <input
            type="number"
            min={5000}
            max={50000}
            step={1000}
            value={params.pathCount}
            onChange={(e) =>
              setParams((p) => ({ ...p, pathCount: Number.parseInt(e.target.value, 10) || 12_000 }))
            }
          />
        </label>
        <label className="quant-trader-field sm:col-span-2">
          <span>Risk outlook</span>
          <select
            value={params.perPortfolioRisk ? "per_portfolio" : params.risk}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "per_portfolio") {
                setParams((p) => ({ ...p, perPortfolioRisk: true, portfolioScope: "all" }));
                return;
              }
              setParams((p) => ({
                ...p,
                perPortfolioRisk: false,
                risk: v as McRiskTolerance,
                portfolioScope: "all"
              }));
            }}
          >
            <option value="per_portfolio">Per portfolio (desk profile)</option>
            <option value="conservative">Conservative</option>
            <option value="moderate">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
      </div>

      {context?.hotWatchlistSymbols?.length ? (
        <p className="quant-trader-panel__watchlist xoptions-hint text-xs">
          Watchlist IV context:{" "}
          <span className="font-mono text-[var(--xf-text-200)]">
            {context.hotWatchlistSymbols.slice(0, 6).join(", ")}
          </span>
        </p>
      ) : null}

      {error ? <p className="xoptions-alert">{error}</p> : null}

      {loading && !result ? (
        <p className="xoptions-hint text-sm text-[var(--xf-text-400)]">Running Monte Carlo paths…</p>
      ) : null}

      {result ? (
        <div className="quant-trader-panel__results space-y-3">
          <div className="quant-trader-metrics grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="quant-trader-metric">
              <span className="quant-trader-metric__label">1D VaR (95%)</span>
              <span className="quant-trader-metric__value">
                {result.combinedTailRisk
                  ? `${result.combinedTailRisk.var1dPct95.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="quant-trader-metric">
              <span className="quant-trader-metric__label">1D CVaR (95%)</span>
              <span className="quant-trader-metric__value">
                {result.combinedTailRisk
                  ? `${result.combinedTailRisk.cvar1dPct95.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="quant-trader-metric">
              <span className="quant-trader-metric__label">Prob. profit (est.)</span>
              <span className="quant-trader-metric__value quant-trader-metric__value--gain">
                {combinedProbProfit != null ? `${combinedProbProfit.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="quant-trader-metric">
              <span className="quant-trader-metric__label">Risk tier</span>
              <span className="quant-trader-metric__value">{mcTierLabel(result.risk)}</span>
            </div>
          </div>

          <QuantTraderDistributionChart ref={chartRef} series={chartSeries} />

          {payoffOverlay ? (
            <details className="xoptions-payoff-card quant-trader-payoff-overlay">
              <summary className="xoptions-payoff-card__summary">Strategy payoff overlay</summary>
              <div className="xoptions-payoff-card__body p-2">
                <XoptionsContractPayoffChart
                  side={payoffOverlay.side}
                  strike={payoffOverlay.strike}
                  premium={payoffOverlay.premium}
                  spot={payoffOverlay.spot}
                  ivPercent={payoffOverlay.ivPercent}
                  expirationYyyyMmDd={payoffOverlay.expirationYyyyMmDd}
                />
              </div>
            </details>
          ) : null}

          {greeksRows.length > 0 ? (
            <div className="quant-trader-greeks overflow-x-auto">
              <p className="xoptions-workspace__label mb-1 text-xs">Greeks exposure heatmap</p>
              <table className="quant-trader-greeks__table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Δ notional</th>
                    <th>Γ notional</th>
                    <th>Θ/day</th>
                    <th>Vega/IV pt</th>
                  </tr>
                </thead>
                <tbody>
                  {greeksRows.map((g) => (
                    <tr key={`${g.symbol}-${g.side}`}>
                      <td className="font-mono">{g.symbol}</td>
                      <td className={greekHeatClass(g.deltaNotionalUsd, "delta")}>
                        {formatUsd(g.deltaNotionalUsd)}
                      </td>
                      <td className={greekHeatClass(g.gammaNotionalUsd, "delta")}>
                        {formatUsd(g.gammaNotionalUsd)}
                      </td>
                      <td className={greekHeatClass(g.thetaDailyUsd, "theta")}>
                        {formatUsd(g.thetaDailyUsd)}
                      </td>
                      <td>{formatUsd(g.vegaPerIvPtUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="quant-trader-panel__actions flex flex-wrap gap-2">
            <button
              type="button"
              className="xoptions-next-btn"
              disabled={busyAction === "job"}
              onClick={() => void saveStrategyJob()}
            >
              Save as Strategy Job
            </button>
            <button type="button" className="xoptions-text-link" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="xoptions-text-link" onClick={() => void exportPdf()}>
              Export PDF
            </button>
            <button type="button" className="xoptions-text-link" onClick={sendToXchat}>
              Apply to xChat Quant Trader
            </button>
            <Link className="xoptions-text-link" href="/xoptions/quant-trader">
              Full quant desk
            </Link>
          </div>

          <p className="quant-trader-disclaimer text-[0.625rem] leading-snug text-[var(--xf-text-500)]">
            Not investment advice. Simulations are model-based estimates. {result.disclaimer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
