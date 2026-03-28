"use client";

import {
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
    type ChartData,
    type ChartOptions
} from "chart.js";
import annotationPlugin, { type AnnotationOptions, type AnnotationPluginOptions } from "chartjs-plugin-annotation";
import { useMemo } from "react";
import { Line } from "react-chartjs-2";

import {
    buildPayoffSeries,
    estimateBreakevenPrices,
    getUniqueStrikes,
    type OptionsPayoffLeg
} from "@/lib/options-payoff";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler, annotationPlugin);

type OptionsPayoffChartProps = {
  legs: OptionsPayoffLeg[];
  currentPrice: number;
  darkMode?: boolean;
  pointCount?: number;
  minPrice?: number;
  maxPrice?: number;
  className?: string;
  title?: string;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function OptionsPayoffChart({
  legs,
  currentPrice,
  darkMode = true,
  pointCount = 240,
  minPrice,
  maxPrice,
  className,
  title = "P/L at expiration"
}: OptionsPayoffChartProps) {
  const series = useMemo(
    () => buildPayoffSeries(legs, currentPrice, { pointCount, minPrice, maxPrice }),
    [legs, currentPrice, pointCount, minPrice, maxPrice]
  );
  const strikes = useMemo(() => getUniqueStrikes(legs), [legs]);
  const breakevens = useMemo(() => estimateBreakevenPrices(series), [series]);

  const palette = darkMode
    ? {
        text: "#e2e8f0",
        mutedText: "#94a3b8",
        grid: "rgba(148, 163, 184, 0.22)",
        payoff: "#39ff14",
        payoffFillTop: "rgba(57, 255, 20, 0.26)",
        payoffFillBottom: "rgba(57, 255, 20, 0.02)",
        strike: "rgba(148, 163, 184, 0.75)",
        spot: "#eab308",
        breakeven: "#fb7185",
        zeroLine: "rgba(248, 250, 252, 0.32)",
        tooltipBg: "rgba(2, 6, 23, 0.95)"
      }
    : {
        text: "#0f172a",
        mutedText: "#334155",
        grid: "rgba(51, 65, 85, 0.18)",
        payoff: "#15803d",
        payoffFillTop: "rgba(21, 128, 61, 0.24)",
        payoffFillBottom: "rgba(21, 128, 61, 0.02)",
        strike: "rgba(71, 85, 105, 0.7)",
        spot: "#a16207",
        breakeven: "#be123c",
        zeroLine: "rgba(15, 23, 42, 0.32)",
        tooltipBg: "rgba(248, 250, 252, 0.96)"
      };

  const data = useMemo<ChartData<"line">>(
    () => ({
      datasets: [
        {
          label: title,
          data: series.map((point) => ({ x: point.underlyingPrice, y: point.payoff })),
          borderColor: palette.payoff,
          borderWidth: 2.25,
          pointRadius: 0,
          pointHoverRadius: 2.5,
          tension: 0,
          fill: true,
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: canvas, chartArea } = chart;
            if (!chartArea) {
              return palette.payoffFillTop;
            }
            const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, palette.payoffFillTop);
            gradient.addColorStop(1, palette.payoffFillBottom);
            return gradient;
          }
        }
      ]
    }),
    [palette, series, title]
  );

  const annotationOptions = useMemo<AnnotationPluginOptions>(() => {
    const annotations: Record<string, AnnotationOptions> = {
      currentPrice: {
        type: "line",
        xMin: currentPrice,
        xMax: currentPrice,
        borderColor: palette.spot,
        borderWidth: 1.35,
        borderDash: [6, 4],
        label: {
          display: true,
          content: `Spot ${money(currentPrice)}`,
          position: "start",
          color: palette.text,
          backgroundColor: "transparent",
          font: { weight: "bold", size: 10 }
        }
      }
    };

    strikes.forEach((strike, index) => {
      annotations[`strike-${index}`] = {
        type: "line",
        xMin: strike,
        xMax: strike,
        borderColor: palette.strike,
        borderWidth: 1,
        borderDash: [5, 5],
        label: {
          display: true,
          content: `K ${money(strike)}`,
          color: palette.mutedText,
          backgroundColor: "transparent",
          position: "start",
          font: { size: 9 }
        }
      };
    });

    breakevens.forEach((breakeven, index) => {
      annotations[`breakeven-${index}`] = {
        type: "line",
        xMin: breakeven,
        xMax: breakeven,
        borderColor: palette.breakeven,
        borderWidth: 1.2,
        borderDash: [4, 4],
        label: {
          display: true,
          content: `BE ${money(breakeven)}`,
          color: palette.breakeven,
          backgroundColor: "transparent",
          position: "end",
          font: { size: 9, weight: "bold" }
        }
      };
    });

    return { annotations };
  }, [breakevens, currentPrice, palette, strikes]);

  const options = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: palette.text,
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: "line"
          }
        },
        tooltip: {
          backgroundColor: palette.tooltipBg,
          titleColor: palette.text,
          bodyColor: palette.text,
          borderColor: palette.grid,
          borderWidth: 1,
          callbacks: {
            title: (items) => {
              const item = items[0];
              return item ? `Underlying ${money(Number(item.parsed.x ?? 0))}` : "Underlying";
            },
            label: (item) => `P/L ${money(Number(item.parsed.y ?? 0))}`
          }
        },
        annotation: annotationOptions
      },
      scales: {
        x: {
          type: "linear",
          ticks: {
            color: palette.mutedText,
            callback: (value) => money(Number(value))
          },
          grid: { color: palette.grid },
          border: { color: palette.grid },
          title: {
            display: true,
            text: "Underlying price at expiration",
            color: palette.text
          }
        },
        y: {
          ticks: {
            color: palette.mutedText,
            callback: (value) => money(Number(value))
          },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? palette.zeroLine : palette.grid)
          },
          border: { color: palette.grid },
          title: {
            display: true,
            text: "Net profit / loss",
            color: palette.text
          }
        }
      }
    }),
    [annotationOptions, palette]
  );

  return (
    <div
      className={className}
      style={{
        width: "100%",
        minHeight: "320px",
        height: "min(52dvh, 460px)"
      }}
    >
      <Line data={data} options={options} />
    </div>
  );
}

export type { OptionsPayoffLeg };
