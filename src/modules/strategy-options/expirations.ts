/**
 * Expiration list — ported from xfinance-strategy `apps/frontend/src/app/api/options/expirations/route.ts`.
 */
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { NextResponse } from "next/server";

import { parseUnderlying } from "@/modules/strategy-options/query-validation";

/** US equity weekly options typically expire on Fridays (UTC calendar day). */
export function isUtcFridayYyyyMmDd(yyyyMmDd: string): boolean {
  const s = yyyyMmDd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false;
  }
  const d = new Date(`${s}T12:00:00.000Z`);
  return d.getUTCDay() === 5;
}

/**
 * Prefer Friday expirations; if that would drop everything (unusual data), return sorted unique dates unchanged.
 */
export function preferFridayExpirations(yyyyMmDd: string[]): string[] {
  const sorted = [...new Set(yyyyMmDd)].sort(
    (a, b) => new Date(a.slice(0, 10)).getTime() - new Date(b.slice(0, 10)).getTime()
  );
  const fridays = sorted.filter(isUtcFridayYyyyMmDd);
  return fridays.length > 0 ? fridays : sorted;
}

/** GET query: `underlying` (required). */
export async function getStrategyOptionExpirations(requestUrl: string): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(requestUrl);
    const underlyingResult = parseUnderlying(searchParams.get("underlying"));
    if (!underlyingResult.ok) {
      return NextResponse.json({ error: underlyingResult.error }, { status: underlyingResult.status });
    }
    const underlying = underlyingResult.value;

    const result = await getYahooFinance2().options(underlying);
    const dates = (result as { expirationDates?: (Date | string)[] }).expirationDates ?? [];
    const raw = dates.map((d) => {
      const x = d instanceof Date ? d : new Date(d);
      const y = x.getUTCFullYear();
      const m = String(x.getUTCMonth() + 1).padStart(2, "0");
      const day = String(x.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    });
    const expirationDates = preferFridayExpirations(raw);

    return NextResponse.json({ underlying, expirationDates });
  } catch (error) {
    console.error("[strategy-options/expirations] fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch expiration dates" }, { status: 500 });
  }
}
