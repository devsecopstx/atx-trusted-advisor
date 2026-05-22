/**
 * US equity session calendar in America/New_York — pure logic, safe for Client Components.
 * Holiday keys match NY civil calendar dates (NYSE); not `ymd.format(UTC midnight)` which can
 * shift the local calendar day (e.g. Good Friday keyed as 04-02 instead of 04-03).
 * (Mongo-backed snapshots live in {@link ./tenant-market-calendar}.)
 */

const MARKET_TIMEZONE = "America/New_York";

export type MarketDayContext = {
  marketDate: string;
  timezone: string;
  isBusinessDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  marketWindowOpen: boolean;
};

const weekdayShort = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIMEZONE,
  weekday: "short"
});
const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: MARKET_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const hm = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

/** Gregorian civil date as YYYY-MM-DD (same shape as `ymd.format` for NY “today”). */
function civilYmdKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Weekday 0=Sun … 6=Sat for this Gregorian civil date (noon UTC avoids DST edge). */
function gregorianWeekdaySun0(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function daysInGregorianMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function nthWeekdayOfGregorianMonth(
  year: number,
  month1: number,
  weekdaySun0: number,
  nth: number
): string {
  const dim = daysInGregorianMonth(year, month1);
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    if (gregorianWeekdaySun0(year, month1, d) === weekdaySun0) {
      count += 1;
      if (count === nth) {
        return civilYmdKey(year, month1, d);
      }
    }
  }
  return civilYmdKey(year, month1, 1);
}

function lastWeekdayOfGregorianMonth(year: number, month1: number, weekdaySun0: number): string {
  const dim = daysInGregorianMonth(year, month1);
  for (let d = dim; d >= 1; d--) {
    if (gregorianWeekdaySun0(year, month1, d) === weekdaySun0) {
      return civilYmdKey(year, month1, d);
    }
  }
  return civilYmdKey(year, month1, dim);
}

function easterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function goodFridayCivilKey(year: number): string {
  const e = easterSundayUtc(year);
  const ey = e.getUTCFullYear();
  const em = e.getUTCMonth() + 1;
  const ed = e.getUTCDate();
  const gf = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
  gf.setUTCDate(gf.getUTCDate() - 2);
  return civilYmdKey(gf.getUTCFullYear(), gf.getUTCMonth() + 1, gf.getUTCDate());
}

/**
 * Fixed-date holiday with NYSE-style weekend observation (Sat → prior Fri, Sun → following Mon).
 */
function observedFixedHolidayCivilKey(month1: number, day: number, year: number): string {
  const wd = gregorianWeekdaySun0(year, month1, day);
  const t = new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0));
  if (wd === 6) {
    t.setUTCDate(t.getUTCDate() - 1);
  } else if (wd === 0) {
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return civilYmdKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function buildNyseHolidayMap(year: number): Map<string, string> {
  const holidayMap = new Map<string, string>();
  holidayMap.set(observedFixedHolidayCivilKey(1, 1, year), "New Year's Day");
  holidayMap.set(nthWeekdayOfGregorianMonth(year, 1, 1, 3), "Martin Luther King Jr. Day");
  holidayMap.set(nthWeekdayOfGregorianMonth(year, 2, 1, 3), "Presidents Day");
  holidayMap.set(goodFridayCivilKey(year), "Good Friday");
  holidayMap.set(lastWeekdayOfGregorianMonth(year, 5, 1), "Memorial Day");
  holidayMap.set(observedFixedHolidayCivilKey(6, 19, year), "Juneteenth");
  holidayMap.set(observedFixedHolidayCivilKey(7, 4, year), "Independence Day");
  holidayMap.set(nthWeekdayOfGregorianMonth(year, 9, 1, 1), "Labor Day");
  holidayMap.set(nthWeekdayOfGregorianMonth(year, 11, 4, 4), "Thanksgiving");
  holidayMap.set(observedFixedHolidayCivilKey(12, 25, year), "Christmas Day");
  return holidayMap;
}

function parseYmd(value: Date): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = ymd.format(value).split("-");
  return {
    year: Number.parseInt(yearStr ?? "0", 10),
    month: Number.parseInt(monthStr ?? "0", 10),
    day: Number.parseInt(dayStr ?? "0", 10)
  };
}

function parseHm(value: Date): { hour: number; minute: number } {
  const [hourStr, minuteStr] = hm.format(value).split(":");
  return {
    hour: Number.parseInt(hourStr ?? "0", 10),
    minute: Number.parseInt(minuteStr ?? "0", 10)
  };
}

export function resolveUsMarketDayContext(value: Date): MarketDayContext {
  const { year, month, day } = parseYmd(value);
  const dateStr = ymd.format(value);
  const dayShort = weekdayShort.format(value);
  const { hour, minute } = parseHm(value);

  const holidayMap = buildNyseHolidayMap(year);
  const holidayName = holidayMap.get(dateStr);
  const isHoliday = Boolean(holidayName);

  const civilDow = gregorianWeekdaySun0(year, month, day);
  const isWeekend = civilDow === 0 || civilDow === 6 || dayShort === "Sat" || dayShort === "Sun";
  const isBusinessDay = !isWeekend && !isHoliday;
  const minuteOfDay = hour * 60 + minute;
  const marketOpenMinute = 9 * 60 + 30;
  const marketCloseMinute = 16 * 60;
  const marketWindowOpen = isBusinessDay && minuteOfDay >= marketOpenMinute && minuteOfDay <= marketCloseMinute;

  return {
    marketDate: dateStr,
    timezone: MARKET_TIMEZONE,
    isBusinessDay,
    isHoliday,
    holidayName,
    marketWindowOpen
  };
}

const MARKET_OPEN_MINUTE = 9 * 60 + 30;

function addCivilDaysKey(civilYmd: string, days: number): string {
  const [y, mo, d] = civilYmd.split("-").map((x) => Number.parseInt(x, 10));
  const t = new Date(Date.UTC(y!, mo! - 1, d! + days, 12, 0, 0));
  return civilYmdKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Wall-clock instant in America/New_York for a civil YYYY-MM-DD + hour/minute. */
export function dateAtNyWallClock(civilYmd: string, hour: number, minute: number): Date {
  const [y, mo, d] = civilYmd.split("-").map((x) => Number.parseInt(x, 10));
  let ms = Date.UTC(y!, mo! - 1, d!, 14, minute, 0);
  if (hour !== 14) {
    ms = Date.UTC(y!, mo! - 1, d!, hour + 5, minute, 0);
  }
  for (let iter = 0; iter < 32; iter++) {
    const probe = new Date(ms);
    if (ymd.format(probe) !== civilYmd) {
      const probeParts = parseYmd(probe);
      const targetNoon = Date.UTC(y!, mo! - 1, d!, 12, 0, 0);
      const probeNoon = Date.UTC(probeParts.year, probeParts.month - 1, probeParts.day, 12, 0, 0);
      ms += targetNoon > probeNoon ? 3 * 3_600_000 : -3 * 3_600_000;
      continue;
    }
    const hmParsed = parseHm(probe);
    const deltaMin = hour * 60 + minute - (hmParsed.hour * 60 + hmParsed.minute);
    if (deltaMin === 0) {
      return probe;
    }
    ms += deltaMin * 60_000;
  }
  return new Date(ms);
}

/** Next US regular-session open (9:30 ET) strictly after `now`, or null when already open. */
export function resolveNextUsMarketOpenAt(now: Date): Date | null {
  const ctx = resolveUsMarketDayContext(now);
  if (ctx.marketWindowOpen) {
    return null;
  }
  const { hour, minute } = parseHm(now);
  const minuteOfDay = hour * 60 + minute;
  if (ctx.isBusinessDay && minuteOfDay < MARKET_OPEN_MINUTE) {
    return dateAtNyWallClock(ctx.marketDate, 9, 30);
  }
  let cursor = ctx.marketDate;
  for (let i = 0; i < 14; i++) {
    cursor = addCivilDaysKey(cursor, 1);
    const probe = dateAtNyWallClock(cursor, 12, 0);
    const dayCtx = resolveUsMarketDayContext(probe);
    if (dayCtx.isBusinessDay) {
      return dateAtNyWallClock(cursor, 9, 30);
    }
  }
  return null;
}

/** Human countdown until session open, e.g. `2h 15m` or `45m`. */
export function formatUsMarketOpensInLabel(now: Date, openAt: Date): string {
  const ms = openAt.getTime() - now.getTime();
  if (ms <= 0) {
    return "soon";
  }
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

export type UsMarketSessionStatus = {
  label: "Open" | "Closed";
  detail: string;
  /** Workspace header badge copy (includes opens-in when closed). */
  headerLabel: string;
};

function closedStatus(
  detail: string,
  now: Date
): UsMarketSessionStatus {
  const nextOpen = resolveNextUsMarketOpenAt(now);
  const opensIn = nextOpen ? formatUsMarketOpensInLabel(now, nextOpen) : null;
  const headerLabel = opensIn ? `Closed · opens in ${opensIn}` : "Closed";
  const detailWithCountdown = opensIn ? `${detail} · opens in ${opensIn}` : detail;
  return { label: "Closed", detail: detailWithCountdown, headerLabel };
}

/** Short label + detail string for workspace / portfolio headers (US regular session, ET). */
export function usMarketSessionStatusLabel(
  m: MarketDayContext,
  now: Date = new Date()
): UsMarketSessionStatus {
  if (m.marketWindowOpen) {
    return { label: "Open", detail: "US regular session (ET)", headerLabel: "Open" };
  }
  if (m.isHoliday) {
    return closedStatus(m.holidayName ?? "Market holiday", now);
  }
  if (!m.isBusinessDay) {
    return closedStatus("Weekend", now);
  }
  return closedStatus("Outside 9:30–4:00 ET", now);
}
