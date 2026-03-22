/**
 * Expiration list — ported from xfinance-strategy `apps/frontend/src/app/api/options/expirations/route.ts`.
 */
import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

import { parseUnderlying } from "@/modules/strategy-options/query-validation";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** GET query: `underlying` (required). */
export async function getStrategyOptionExpirations(requestUrl: string): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(requestUrl);
    const underlyingResult = parseUnderlying(searchParams.get("underlying"));
    if (!underlyingResult.ok) {
      return NextResponse.json({ error: underlyingResult.error }, { status: underlyingResult.status });
    }
    const underlying = underlyingResult.value;

    const result = await yahooFinance.options(underlying);
    const dates = (result as { expirationDates?: (Date | string)[] }).expirationDates ?? [];
    const expirationDates = dates.map((d) => {
      const x = d instanceof Date ? d : new Date(d);
      const y = x.getUTCFullYear();
      const m = String(x.getUTCMonth() + 1).padStart(2, "0");
      const day = String(x.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    });

    return NextResponse.json({ underlying, expirationDates });
  } catch (error) {
    console.error("[strategy-options/expirations] fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch expiration dates" }, { status: 500 });
  }
}
