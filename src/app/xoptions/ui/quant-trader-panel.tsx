"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    QuantTraderDistributionChart,
    type QuantTraderDistributionPoint
} from "@/app/xoptions/ui/quant-trader-distribution-chart";
import { XoptionsContractPayoffChart } from "@/app/xoptions/xoptions-contract-payoff-chart";
import { writeXchatPendingComposerHandoff } from "@/lib/xchat/xchat-pending-prompt";
import {
    buildQuantTraderXchatPrompt,
    estimateProbProfitPct,
    mcTierLabel,
    QUANT_TRADER_DEFAULT_PARAMS,
    quantTraderResultsToCsv,
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

  const exportCsv = useCallback(() => {
    if (!result) {
      return;
    }
    const blob = new Blob([quantTraderResultsToCsv(result)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quant-trader-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const exportPdf = useCallback(() => {
    if (!result) {
      return;
    }
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("xFinance Quant Trader — Monte Carlo Summary", 42, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `${params.horizonDays}-day horizon · IV rank > ${params.minIvRankPct}% · max DD ${params.maxDrawdownPct}%`,
      42,
      64
    );
    autoTable(doc, {
      startY: 80,
      head: [["Portfolio", "VaR 1D", "CVaR 1D", "P(DD>20%)", "Gate"]],
      body: result.portfolios.map((p) => [
        p.portfolioName,
        p.tailRisk ? `${p.tailRisk.var1dPct95.toFixed(1)}%` : "—",
        p.tailRisk ? `${p.tailRisk.cvar1dPct95.toFixed(1)}%` : "—",
        p.tailRisk ? `${(p.tailRisk.probDrawdownGt20Pct * 100).toFixed(1)}%` : "—",
        p.drawdownGate ? (p.drawdownGate.passed ? "Pass" : "Review") : "—"
      ])
    });
    doc.setFontSize(8);
    doc.text(result.disclaimer, 42, doc.internal.pageSize.getHeight() - 24, { maxWidth: 528 });
    doc.save(`quant-trader-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [params.horizonDays, params.maxDrawdownPct, params.minIvRankPct, result]);

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

          <QuantTraderDistributionChart series={chartSeries} />

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
            <button type="button" className="xoptions-text-link" onClick={exportPdf}>
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
