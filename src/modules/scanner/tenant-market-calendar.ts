import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";

import type { MarketDayContext } from "./us-market-day-context";

export { resolveUsMarketDayContext, usMarketSessionStatusLabel } from "./us-market-day-context";
export type { MarketDayContext } from "./us-market-day-context";

const TENANT_MARKET_CALENDAR_COLLECTION = "tenant_market_calendar";

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
