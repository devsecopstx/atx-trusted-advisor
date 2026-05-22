/** UTC midnight for the given instant — matches admin hub "Logins today (UTC)". */
export function startOfUtcDay(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Inclusive window for today's login audit list (UTC day start → now). */
export function auditLoginUtcDayBounds(now: Date = new Date()): {
  from: Date;
  to: Date;
  label: string;
} {
  const from = startOfUtcDay(now);
  const label = `${from.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  })} (UTC)`;
  return { from, to: now, label };
}
