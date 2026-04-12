"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type AllocationSlice = { label: string; value: number };

type Props = {
  totalBookUsd: number;
  topSlices: AllocationSlice[]; // e.g., top holdings or asset classes
};

export function PortfoliosAllocationDonut({ totalBookUsd, topSlices }: Props) {
  const { labels, series } = useMemo(() => {
    const positive = topSlices.filter((s) => Number.isFinite(s.value) && s.value > 0);
    const top = positive.slice(0, 4);
    const rest = positive.slice(4);
    const restSum = rest.reduce((a, b) => a + b.value, 0);
    const full = restSum > 0 ? [...top, { label: "Other", value: restSum }] : top;
    return {
      labels: full.map((s) => s.label.toUpperCase()),
      series: full.map((s) => Number(s.value.toFixed(2)))
    };
  }, [topSlices]);

  const options: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: {
        type: "donut",
        background: "transparent",
        animations: { enabled: false },
        toolbar: { show: false }
      },
      stroke: { show: false },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: "right",
        labels: { colors: "var(--xf-text-300)" },
        markers: {
          width: 8,
          height: 8,
          strokeWidth: 0,
          radius: 8
        }
      },
      tooltip: {
        enabled: true,
        theme: "dark",
        y: {
          formatter: (val: number) =>
            val.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
        }
      },
      labels,
      colors: [
        "color-mix(in srgb, var(--xf-gain-green) 85%, #1c1f1c)",
        "#3dd6a0",
        "#21a179",
        "#157a6e",
        "#0f5d50"
      ],
      theme: { mode: "dark" }
    }),
    [labels]
  );

  return (
    <section className="mt-3 rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-gain-green)]">
          Book allocation
        </h3>
        <p className="m-0 font-mono text-xs text-[var(--xf-text-300)]">
          Total {totalBookUsd.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
        </p>
      </div>
      {series.length > 0 ? (
        <div className="flex items-center">
          <div className="min-w-0 flex-1">
            {/* 240x160 compact donut */}
            {/* @ts-expect-error dynamic import types */}
            <ReactApexChart options={options} series={series} type="donut" height={160} />
          </div>
        </div>
      ) : (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">No allocation data.</p>
      )}
    </section>
  );
}
