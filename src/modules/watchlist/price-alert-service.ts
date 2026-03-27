import { adminCreatePortfolioAlert } from "@/modules/core-admin/repository";
import type { WatchlistSymbol } from "@/modules/core-admin/types";

/** Default minimum absolute % move vs prior `lastPrice` before creating a portfolio alert. */
export const DEFAULT_MIN_ABS_MOVE_PERCENT = 5;

export type WatchlistPriceTick = {
  symbol: string;
  lastPrice: number;
};

export type PriceMoveEvaluation = {
  symbol: string;
  newPrice: number;
  changePct: number;
};

/**
 * PriceAlertService — evaluates watchlist price crosses after fresh quotes.
 * Pure evaluation + persistence via `portfolio_alerts` (admin path).
 */
export function evaluateSignificantPriceMoves(
  symbolsBefore: ReadonlyArray<WatchlistSymbol>,
  priceUpdates: ReadonlyArray<WatchlistPriceTick>,
  minAbsMovePercent: number = DEFAULT_MIN_ABS_MOVE_PERCENT
): PriceMoveEvaluation[] {
  const out: PriceMoveEvaluation[] = [];
  for (const u of priceUpdates) {
    const before = symbolsBefore.find((s) => s.symbol === u.symbol);
    const prev = before?.lastPrice;
    if (prev === undefined || prev <= 0) {
      continue;
    }
    const changePct = Math.abs((u.lastPrice - prev) / prev) * 100;
    if (changePct > minAbsMovePercent) {
      out.push({ symbol: u.symbol, newPrice: u.lastPrice, changePct });
    }
  }
  return out;
}

export async function persistPriceMoveAlerts(
  portfolioIdHex: string,
  evaluations: ReadonlyArray<PriceMoveEvaluation>
): Promise<number> {
  let created = 0;
  for (const e of evaluations) {
    const row = await adminCreatePortfolioAlert({
      portfolioId: portfolioIdHex,
      title: `${e.symbol} price alert`,
      body: `Price moved ${e.changePct.toFixed(1)}% to $${e.newPrice}`,
      severity: "info",
      symbol: e.symbol,
    });
    if (row) {
      created += 1;
    }
  }
  return created;
}
