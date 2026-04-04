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

/** Fallback expiration grid when provider dates are unavailable. */
export function buildUpcomingFridayExpirations(
  input: { fromDate?: Date; count?: number } = {}
): string[] {
  const count = Math.max(1, Math.min(16, input.count ?? 8));
  const now = input.fromDate ?? new Date();
  const startUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0)
  );
  const out: string[] = [];
  const cursor = new Date(startUtc);
  while (out.length < count) {
    const weekday = cursor.getUTCDay();
    const isFriday = weekday === 5;
    if (isFriday) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const d = String(cursor.getUTCDate()).padStart(2, "0");
      out.push(`${y}-${m}-${d}`);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function normalizeExpirationDateToken(raw: Date | string): string | null {
  const parsed = raw instanceof Date ? raw : new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isLikelyNoOptionsDataError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("no data") ||
    normalized.includes("no options") ||
    normalized.includes("option chain") ||
    normalized.includes("404")
  );
}

/** GET query: `underlying` (required). */
export async function getStrategyOptionExpirations(requestUrl: string): Promise<NextResponse> {
  const { searchParams } = new URL(requestUrl);
  const underlyingResult = parseUnderlying(searchParams.get("underlying"));
  if (!underlyingResult.ok) {
    return NextResponse.json({ error: underlyingResult.error }, { status: underlyingResult.status });
  }
  const underlying = underlyingResult.value;
  try {
    const result = await getYahooFinance2().options(underlying);
    const dates = (result as { expirationDates?: (Date | string)[] }).expirationDates ?? [];
    const raw = dates
      .map(normalizeExpirationDateToken)
      .filter((value): value is string => value !== null);
    const expirationDates =
      raw.length > 0 ? preferFridayExpirations(raw) : buildUpcomingFridayExpirations({ count: 8 });

    return NextResponse.json({ underlying, expirationDates });
  } catch (error) {
    if (isLikelyNoOptionsDataError(error)) {
      console.warn("[strategy-options/expirations] no options data", {
        error: error instanceof Error ? error.message : String(error)
      });
      return NextResponse.json({
        underlying,
        expirationDates: buildUpcomingFridayExpirations({ count: 8 })
      });
    }
    console.error("[strategy-options/expirations] provider fetch failed; using fallback expirations:", error);
    return NextResponse.json({
      underlying,
      expirationDates: buildUpcomingFridayExpirations({ count: 8 })
    });
  }
}
