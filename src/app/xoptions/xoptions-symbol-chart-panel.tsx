"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { downsampleTimeSeries } from "@/lib/chart/downsample-time-series";
import { useXfUiSoft } from "@/lib/use-xf-ui-soft";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

/** Apex candlestick + volume stay responsive on long histories */
const MAX_CHART_CANDLES = 420;

type Candle = { t: string; o: number; h: number; l: number; c: number; v: number };

export function XoptionsSymbolChartPanel({ symbol, enabled }: { symbol: string; enabled: boolean }) {
  const xfSoft = useXfUiSoft();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !symbol.trim()) {
      setCandles([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/app-user/symbol-chart?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as { candles?: Candle[]; error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? "Chart failed");
        }
        if (!cancelled) {
          setCandles(json.candles ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Chart failed");
          setCandles([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, symbol]);

  const chartCandles = useMemo(
    () => downsampleTimeSeries(candles, MAX_CHART_CANDLES),
    [candles]
  );

  const candleSeries = useMemo(
    () =>
      chartCandles.map((c) => ({
        x: new Date(`${c.t}T12:00:00.000Z`),
        y: [c.o, c.h, c.l, c.c] as [number, number, number, number]
      })),
    [chartCandles]
  );

  const volSeries = useMemo(
    () =>
      chartCandles.map((c) => ({
        x: new Date(`${c.t}T12:00:00.000Z`),
        y: c.v
      })),
    [chartCandles]
  );

  const candleChartSeries = useMemo(() => [{ data: candleSeries }], [candleSeries]);
  const volChartSeries = useMemo(
    () => [{ name: "Volume", data: volSeries }],
    [volSeries]
  );

  const chartOptions = useMemo<ApexOptions>(() => {
    const label = xfSoft ? "#64748b" : "#94a3b8";
    const grid = xfSoft ? "rgba(100, 116, 139, 0.22)" : "rgba(148, 163, 184, 0.22)";
    const mode = xfSoft ? "light" : "dark";
    return {
      chart: {
        type: "candlestick",
        background: "transparent",
        toolbar: { show: true },
        zoom: { enabled: true },
        fontFamily: "ui-monospace, monospace"
      },
      theme: { mode },
      plotOptions: {
        candlestick: {
          colors: {
            upward: "#22c55e",
            downward: "#ef4444"
          }
        }
      },
      grid: {
        borderColor: grid
      },
      xaxis: {
        type: "datetime",
        labels: { style: { colors: label } }
      },
      yaxis: {
        tooltip: { enabled: true },
        labels: {
          formatter: (v: number) => v.toFixed(2),
          style: { colors: label }
        },
        opposite: true
      },
      tooltip: { theme: mode }
    };
  }, [xfSoft]);

  const volOptions = useMemo<ApexOptions>(() => {
    const label = xfSoft ? "#64748b" : "#94a3b8";
    const grid = xfSoft ? "rgba(100, 116, 139, 0.16)" : "rgba(148, 163, 184, 0.15)";
    const mode = xfSoft ? "light" : "dark";
    const barColor = xfSoft ? "rgba(139, 92, 246, 0.55)" : "rgba(59, 130, 246, 0.65)";
    return {
      chart: {
        type: "bar",
        background: "transparent",
        height: 140,
        toolbar: { show: false },
        fontFamily: "ui-monospace, monospace"
      },
      colors: [barColor],
      theme: { mode },
      plotOptions: {
        bar: {
          columnWidth: "75%"
        }
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: grid,
        padding: { left: 8, right: 8 }
      },
      xaxis: {
        type: "datetime",
        labels: { show: true, style: { colors: label, fontSize: "10px" } }
      },
      yaxis: {
        labels: {
          formatter: (v: number) => {
            if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
            if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
            if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
            return String(Math.round(v));
          },
          style: { colors: label }
        },
        opposite: true
      },
      tooltip: { theme: mode }
    };
  }, [xfSoft]);

  if (!enabled) {
    return null;
  }

  if (loading) {
    return <p className="xoptions-hint text-sm">Loading price history…</p>;
  }
  if (error) {
    return (
      <p className="xoptions-alert text-sm" role="alert">
        {error}
      </p>
    );
  }
  if (candles.length === 0) {
    return <p className="xoptions-hint text-sm">No OHLC data for this symbol.</p>;
  }

  return (
    <div className="xoptions-full-chain__chart-stack space-y-3">
      <ReactApexChart
        options={chartOptions}
        series={candleChartSeries}
        type="candlestick"
        height={360}
      />
      <p className="xoptions-mid-three__label mb-0 text-[0.625rem] opacity-80">Volume</p>
      <ReactApexChart
        options={volOptions}
        series={volChartSeries}
        type="bar"
        height={160}
      />
    </div>
  );
}
