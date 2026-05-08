"use client";

import { SymbolOhlcChartPanel } from "@/app/ui/symbol-ohlc-chart-panel";

export function XoptionsSymbolChartPanel({ symbol, enabled }: { symbol: string; enabled: boolean }) {
  return (
    <div className="xoptions-full-chain__chart-stack space-y-3">
      <SymbolOhlcChartPanel symbol={symbol} enabled={enabled} initialRange="6m" variant="full" showRangeSelector />
    </div>
  );
}
