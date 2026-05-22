import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { parseSymbolChartRange, resolveYahooChartWindow } from "@/modules/yahoo/symbol-chart-range";
import { yahooChartWithValidationFallback } from "@/modules/yahoo/yahoo-chart-validation-fallback";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

export const dynamic = "force-dynamic";

export type SymbolChartCandle = {
  /** ISO 8601 — intraday includes time; daily is date at UTC midnight from Yahoo */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

function isoFromChartDate(d: Date | string): string | null {
  if (d instanceof Date) {
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const parsed = new Date(d);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/** Next-local Yahoo chart — no Spring route; do not BFF-proxy (would 404 on JVM). */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("symbol")?.trim() ?? "";
  const symbol = raw.toUpperCase();
  if (!symbol || !/^[A-Z0-9.\-^]+$/.test(symbol)) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const range = parseSymbolChartRange(searchParams.get("range"));

  try {
    const yf = getYahooFinance2();
    const { period1, period2, interval } = resolveYahooChartWindow(range);
    const chart = (await yahooChartWithValidationFallback(yf, symbol, {
      period1,
      period2,
      interval
    })) as {
      quotes?: Array<{
        date: Date | string;
        open: number | null;
        high: number | null;
        low: number | null;
        close: number | null;
        volume: number | null;
      }>;
    };
    const quotes = chart.quotes ?? [];
    const candles: SymbolChartCandle[] = [];
    for (const q of quotes) {
      const o = q.open;
      const h = q.high;
      const l = q.low;
      const c = q.close;
      const v = q.volume;
      if (
        o == null ||
        h == null ||
        l == null ||
        c == null ||
        !Number.isFinite(o) ||
        !Number.isFinite(h) ||
        !Number.isFinite(l) ||
        !Number.isFinite(c)
      ) {
        continue;
      }
      const t = isoFromChartDate(q.date);
      if (!t) {
        continue;
      }
      const vol = typeof v === "number" && Number.isFinite(v) ? v : 0;
      candles.push({
        t,
        o,
        h,
        l,
        c,
        v: vol
      });
    }
    return NextResponse.json({ symbol, range, candles });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chart failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
