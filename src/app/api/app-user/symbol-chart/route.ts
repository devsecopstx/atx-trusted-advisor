import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

export const dynamic = "force-dynamic";

export type SymbolChartCandle = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

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

  try {
    const yf = getYahooFinance2();
    const period2 = new Date();
    const period1 = new Date(period2.getTime() - 200 * 24 * 60 * 60 * 1000);
    const chart = (await yf.chart(symbol, {
      period1,
      period2,
      interval: "1d"
    })) as { quotes?: Array<{ date: Date; open: number | null; high: number | null; low: number | null; close: number | null; volume: number | null }> };
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
      const vol = typeof v === "number" && Number.isFinite(v) ? v : 0;
      candles.push({
        t: q.date.toISOString().slice(0, 10),
        o,
        h,
        l,
        c,
        v: vol
      });
    }
    return NextResponse.json({ symbol, candles });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chart failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
