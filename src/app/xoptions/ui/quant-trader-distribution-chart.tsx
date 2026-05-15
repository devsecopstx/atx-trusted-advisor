"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { forwardRef, useId, useImperativeHandle, useMemo } from "react";

import { resolveDesignTokenColor } from "@/lib/resolve-design-token-color";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type QuantTraderDistributionPoint = {
  label: string;
  var1dPct: number;
  cvar1dPct: number;
  probDrawdownGt20Pct: number;
};

export type QuantTraderDistributionChartHandle = {
  captureDataUri: () => Promise<string | null>;
};

type Props = {
  series: QuantTraderDistributionPoint[];
  height?: number;
};

export const QuantTraderDistributionChart = forwardRef<QuantTraderDistributionChartHandle, Props>(
  function QuantTraderDistributionChart({ series, height = 220 }, ref) {
    const reactId = useId().replace(/:/g, "");
    const chartId = `quant-trader-dist-${reactId}`;

    const gainGreen = resolveDesignTokenColor("--xf-gain-green", "color", "#39ff14");
    const lossRed = resolveDesignTokenColor("--xf-loss-red", "color", "#ef4444");
    const textMuted = resolveDesignTokenColor("--xf-text-400", "color", "#94a3b8");
    const surface = resolveDesignTokenColor("--xf-xoptions-surface", "background", "#0a0f0a");

    useImperativeHandle(
      ref,
      () => ({
        async captureDataUri() {
          if (series.length === 0) {
            return null;
          }
          try {
            const ApexCharts = (await import("apexcharts")).default;
            const out = (await ApexCharts.exec(chartId, "dataURI", { scale: 2 })) as
              | { imgURI?: string }
              | undefined;
            return typeof out?.imgURI === "string" ? out.imgURI : null;
          } catch {
            return null;
          }
        }
      }),
      [chartId, series.length]
    );

    const options: ApexOptions = useMemo(
      () => ({
        chart: {
          id: chartId,
          type: "bar",
          background: surface,
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
      [chartId, series, gainGreen, lossRed, surface, textMuted]
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
);
