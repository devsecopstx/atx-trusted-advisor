import { addCalendarDaysUtc, pickExpirationOnOrAfter } from "@/lib/xoptions/xoptions-chain-helpers";

export const XOPTIONS_DEFAULT_EXPIRATION_HORIZON_DAYS = 14;

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
