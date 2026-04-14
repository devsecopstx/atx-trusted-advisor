import {
    addCalendarDaysUtc,
    pickExpirationOnOrAfter,
    utcDayStartMs
} from "@/lib/xoptions/xoptions-chain-helpers";

export const XOPTIONS_DEFAULT_EXPIRATION_HORIZON_DAYS = 14;

/** Calendar days from today for “weekly” bucket in strike-date picker (4 weeks). */
export const XOPTIONS_STRIKE_DATE_WEEKLY_MAX_DAYS = 28;

/** ~18 months of calendar days for standard monthly (3rd Friday) expirations. */
export const XOPTIONS_STRIKE_DATE_MONTHLY_MAX_DAYS = Math.round((365.25 * 18) / 12);

function utcTodayStartMs(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** US equity-style monthly: Friday with calendar day 15–21 (third Friday). */
export function isThirdFridayExpiration(yyyyMmDd: string): boolean {
  const dayMs = utcDayStartMs(yyyyMmDd.slice(0, 10));
  const d = new Date(dayMs);
  if (d.getUTCDay() !== 5) {
    return false;
  }
  const dom = d.getUTCDate();
  return dom >= 15 && dom <= 21;
}

export type XoptionsStrikeDateExpirationBuckets = {
  weekly: string[];
  monthly: string[];
};

/**
 * Splits Yahoo/API expiration strings into weekly (≤4 weeks) vs standard monthlies (3rd Friday, up to ~18 mo).
 * Past expirations are omitted.
 */
export function partitionExpirationsForStrikeDatePicker(
  dates: string[],
  now: Date = new Date()
): XoptionsStrikeDateExpirationBuckets {
  const today = utcTodayStartMs(now);
  const sorted = [...new Set(dates.map((d) => d.slice(0, 10)))].sort(
    (a, b) => utcDayStartMs(a) - utcDayStartMs(b)
  );
  const weekly: string[] = [];
  const monthly: string[] = [];

  for (const raw of sorted) {
    const expMs = utcDayStartMs(raw);
    const diffDays = Math.round((expMs - today) / (24 * 3600 * 1000));
    if (diffDays < 0) {
      continue;
    }
    if (diffDays <= XOPTIONS_STRIKE_DATE_WEEKLY_MAX_DAYS) {
      weekly.push(raw);
    } else if (diffDays <= XOPTIONS_STRIKE_DATE_MONTHLY_MAX_DAYS && isThirdFridayExpiration(raw)) {
      monthly.push(raw);
    }
  }

  return { weekly, monthly };
}

function sortUniqueExpirationDates(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

export function resolveXoptionsExpirationForHorizon(
  dates: string[],
  horizonDays: number
): string {
  if (dates.length === 0) {
    return "";
  }
  const sorted = sortUniqueExpirationDates(dates);
  if (horizonDays > 0) {
    const target = addCalendarDaysUtc(new Date(), horizonDays);
    return pickExpirationOnOrAfter(sorted, target) ?? sorted[sorted.length - 1] ?? "";
  }
  return pickExpirationOnOrAfter(sorted, new Date()) ?? sorted[0] ?? "";
}
