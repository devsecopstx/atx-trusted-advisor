"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";

import {
    buildPayoffSeries,
    estimateBreakevenPrices,
    getUniqueStrikes,
    type OptionsPayoffLeg
} from "@/lib/options-payoff";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

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

  const palette = useMemo(
    () =>
      darkMode
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
          },
    [darkMode]
  );

  const chartSeries = useMemo(
    () => [
      {
        name: title,
        data: series.map((point) => [point.underlyingPrice, point.payoff] as [number, number])
      }
    ],
    [series, title]
  );

  const options = useMemo<ApexOptions>(() => {
    const xaxisAnnotations: NonNullable<ApexOptions["annotations"]>["xaxis"] = [
      {
        x: currentPrice,
        borderColor: palette.spot,
        strokeDashArray: 6,
        label: {
          text: `Spot ${money(currentPrice)}`,
          borderColor: palette.spot,
          style: {
            color: palette.text,
            background: palette.tooltipBg,
            fontSize: "11px",
            fontWeight: 700
          }
        }
      },
      ...strikes.map((strike) => ({
        x: strike,
        borderColor: palette.strike,
        strokeDashArray: 5,
        label: {
          text: `K ${money(strike)}`,
          borderColor: palette.strike,
          style: {
            color: palette.mutedText,
            background: "transparent",
            fontSize: "10px",
            fontWeight: 600
          }
        }
      })),
      ...breakevens.map((breakeven) => ({
        x: breakeven,
        borderColor: palette.breakeven,
        strokeDashArray: 4,
        label: {
          text: `BE ${money(breakeven)}`,
          borderColor: palette.breakeven,
          style: {
            color: palette.breakeven,
            background: "transparent",
            fontSize: "10px",
            fontWeight: 700
          }
        }
      }))
    ];

    return {
      chart: {
        type: "area",
        toolbar: { show: true },
        zoom: { enabled: true },
        animations: { enabled: true, easing: "easeinout", speed: 260 },
        foreColor: palette.text,
        background: "transparent"
      },
      theme: { mode: darkMode ? "dark" : "light" },
      colors: [palette.payoff],
      dataLabels: { enabled: false },
      stroke: {
        curve: "straight",
        width: 2.25
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.05,
          colorStops: [
            [
              { offset: 0, color: palette.payoffFillTop, opacity: 0.85 },
              { offset: 100, color: palette.payoffFillBottom, opacity: 0.35 }
            ]
          ]
        }
      },
      grid: {
        borderColor: palette.grid,
        strokeDashArray: 2
      },
      legend: {
        show: true,
        labels: { colors: palette.text }
      },
      tooltip: {
        theme: darkMode ? "dark" : "light",
        x: {
          formatter: (value) => `Underlying ${money(Number(value))}`
        },
        y: {
          formatter: (value) => `P/L ${money(Number(value))}`
        }
      },
      xaxis: {
        type: "numeric",
        tickAmount: 8,
        labels: {
          style: { colors: palette.mutedText },
          formatter: (value) => money(Number(value))
        },
        title: {
          text: "Underlying price at expiration",
          style: { color: palette.text }
        }
      },
      yaxis: {
        tickAmount: 7,
        labels: {
          style: { colors: palette.mutedText },
          formatter: (value) => money(Number(value))
        },
        title: {
          text: "Net profit / loss",
          style: { color: palette.text }
        }
      },
      annotations: {
        xaxis: xaxisAnnotations,
        yaxis: [
          {
            y: 0,
            borderColor: palette.zeroLine,
            strokeDashArray: 0,
            label: {
              text: "P/L 0",
              borderColor: palette.zeroLine,
              style: {
                color: palette.mutedText,
                background: "transparent",
                fontSize: "10px",
                fontWeight: 600
              }
            }
          }
        ]
      }
    };
  }, [breakevens, currentPrice, darkMode, palette, strikes]);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        minHeight: "320px",
        height: "min(52dvh, 460px)"
      }}
    >
      <ReactApexChart type="area" series={chartSeries} options={options} height="100%" width="100%" />
    </div>
  );
}

export type { OptionsPayoffLeg };
