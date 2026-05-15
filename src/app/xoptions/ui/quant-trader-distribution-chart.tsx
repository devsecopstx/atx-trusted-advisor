"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";

import { resolveDesignTokenColor } from "@/lib/resolve-design-token-color";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type QuantTraderDistributionPoint = {
  label: string;
  var1dPct: number;
  cvar1dPct: number;
  probDrawdownGt20Pct: number;
};

type Props = {
  series: QuantTraderDistributionPoint[];
  height?: number;
};

export function QuantTraderDistributionChart({ series, height = 220 }: Props) {
  const gainGreen = resolveDesignTokenColor("--xf-gain-green", "color", "#39ff14");
  const lossRed = resolveDesignTokenColor("--xf-loss-red", "color", "#ef4444");
  const textMuted = resolveDesignTokenColor("--xf-text-400", "color", "#94a3b8");

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        background: "transparent",
        toolbar: { show: false },
        fontFamily: "inherit"
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "55%",
          borderRadius: 4
        }
      },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ["transparent"] },
      xaxis: {
        categories: series.map((s) => s.label),
        labels: { style: { colors: textMuted, fontSize: "11px" } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          formatter: (v: number) => `${v.toFixed(1)}%`,
          style: { colors: textMuted, fontSize: "10px" }
        }
      },
      grid: {
        borderColor: "rgba(148,163,184,0.12)",
        strokeDashArray: 4
      },
      legend: {
        labels: { colors: textMuted },
        fontSize: "11px"
      },
      tooltip: {
        theme: "dark",
        y: { formatter: (v: number) => `${v.toFixed(2)}%` }
      },
      colors: [lossRed, "#eab308", gainGreen]
    }),
    [series, gainGreen, lossRed, textMuted]
  );

  const chartSeries = useMemo(
    () => [
      { name: "1D VaR (95%)", data: series.map((s) => s.var1dPct) },
      { name: "1D CVaR (95%)", data: series.map((s) => s.cvar1dPct) },
      { name: "P(DD>20%)", data: series.map((s) => s.probDrawdownGt20Pct * 100) }
    ],
    [series]
  );

  if (series.length === 0) {
    return (
      <p className="xoptions-hint m-0 text-xs text-[var(--xf-text-400)]">
        Run a simulation to see tail-risk distribution.
      </p>
    );
  }

  return (
    <ReactApexChart
      type="bar"
      height={height}
      width="100%"
      options={options}
      series={chartSeries}
    />
  );
}
