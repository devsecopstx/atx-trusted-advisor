import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

const TENANT_MARKET_CALENDAR_COLLECTION = "tenant_market_calendar";
const MARKET_TIMEZONE = "America/New_York";

type MarketState = "open" | "closed";

type TenantMarketCalendarSnapshot = {
  tenantId?: ObjectId;
  marketDate: string;
  timezone: string;
  marketState: MarketState;
  isBusinessDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  marketWindowOpen: boolean;
  symbolCount: number;
  quoteCount: number;
  portfolioCount: number;
  accountCount: number;
  holdingsCount: number;
  watchlistCount: number;
  sourceTaskCategory: string;
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type MarketDayContext = {
  marketDate: string;
  timezone: string;
  isBusinessDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  marketWindowOpen: boolean;
};

type MarketCalendarUpdateInput = {
  tenantId?: ObjectId;
  market: MarketDayContext;
  symbolCount: number;
  quoteCount: number;
  portfolioCount: number;
  accountCount: number;
  holdingsCount: number;
  watchlistCount: number;
  sourceTaskCategory: string;
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

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (7 + weekday - first) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0));
  const lastWeekday = lastDay.getUTCDay();
  const offset = (7 + lastWeekday - weekday) % 7;
  return lastDay.getUTCDate() - offset;
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
  return new Date(Date.UTC(year, month - 1, day));
}

function observedFixedHolidayDate(day: number, month: number, year: number): string {
  const base = new Date(Date.UTC(year, month - 1, day));
  const weekday = base.getUTCDay();
  if (weekday === 6) {
    base.setUTCDate(base.getUTCDate() - 1);
  } else if (weekday === 0) {
    base.setUTCDate(base.getUTCDate() + 1);
  }
  return ymd.format(base);
}

export function resolveUsMarketDayContext(value: Date): MarketDayContext {
  const { year, month, day } = parseYmd(value);
  const dateStr = ymd.format(value);
  const dayShort = weekdayShort.format(value);
  const { hour, minute } = parseHm(value);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  const holidayMap = new Map<string, string>();
  holidayMap.set(observedFixedHolidayDate(1, 1, year), "New Year's Day");
  holidayMap.set(
    ymd.format(new Date(Date.UTC(year, 0, nthWeekdayOfMonth(year, 1, 1, 3)))),
    "Martin Luther King Jr. Day"
  );
  holidayMap.set(
    ymd.format(new Date(Date.UTC(year, 1, nthWeekdayOfMonth(year, 2, 1, 3)))),
    "Presidents Day"
  );
  const easter = easterSundayUtc(year);
  const goodFriday = new Date(easter.getTime());
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  holidayMap.set(ymd.format(goodFriday), "Good Friday");
  holidayMap.set(
    ymd.format(new Date(Date.UTC(year, 4, lastWeekdayOfMonth(year, 5, 1)))),
    "Memorial Day"
  );
  holidayMap.set(observedFixedHolidayDate(19, 6, year), "Juneteenth");
  holidayMap.set(observedFixedHolidayDate(4, 7, year), "Independence Day");
  holidayMap.set(
    ymd.format(new Date(Date.UTC(year, 8, nthWeekdayOfMonth(year, 9, 1, 1)))),
    "Labor Day"
  );
  holidayMap.set(
    ymd.format(new Date(Date.UTC(year, 10, nthWeekdayOfMonth(year, 11, 4, 4)))),
    "Thanksgiving"
  );
  holidayMap.set(observedFixedHolidayDate(25, 12, year), "Christmas Day");

  const holidayName = holidayMap.get(dateStr);
  const isHoliday = Boolean(holidayName);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 || dayShort === "Sat" || dayShort === "Sun";
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

export async function updateTenantMarketCalendarSnapshot(
  input: MarketCalendarUpdateInput
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const filter: Record<string, unknown> = {
    marketDate: input.market.marketDate,
    sourceTaskCategory: input.sourceTaskCategory
  };
  if (input.tenantId) {
    filter.tenantId = input.tenantId;
  } else {
    filter.tenantId = { $exists: false };
  }

  const doc: Omit<TenantMarketCalendarSnapshot, "createdAt"> = {
    tenantId: input.tenantId,
    marketDate: input.market.marketDate,
    timezone: input.market.timezone,
    marketState: input.market.marketWindowOpen ? "open" : "closed",
    isBusinessDay: input.market.isBusinessDay,
    isHoliday: input.market.isHoliday,
    holidayName: input.market.holidayName,
    marketWindowOpen: input.market.marketWindowOpen,
    symbolCount: input.symbolCount,
    quoteCount: input.quoteCount,
    portfolioCount: input.portfolioCount,
    accountCount: input.accountCount,
    holdingsCount: input.holdingsCount,
    watchlistCount: input.watchlistCount,
    sourceTaskCategory: input.sourceTaskCategory,
    checkedAt: now,
    updatedAt: now
  };

  await db.collection<TenantMarketCalendarSnapshot>(TENANT_MARKET_CALENDAR_COLLECTION).updateOne(
    filter,
    {
      $setOnInsert: { createdAt: now },
      $set: doc
    },
    { upsert: true }
  );
}
