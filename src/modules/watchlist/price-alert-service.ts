import { adminCreatePortfolioAlert } from "@/modules/core-admin/repository";
import type { WatchlistSymbol } from "@/modules/core-admin/types";
import { dispatchPortfolioDeskEventsToSlack } from "@/modules/notifications/portfolio-notification-service";

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
  const notify: Array<{ title: string; body: string; symbol: string }> = [];
  for (const e of evaluations) {
    const title = `${e.symbol} price alert`;
    const body = `Price moved ${e.changePct.toFixed(1)}% to $${e.newPrice}`;
    const row = await adminCreatePortfolioAlert({
      portfolioId: portfolioIdHex,
      title,
      body,
      severity: "info",
      symbol: e.symbol,
    });
    if (row) {
      created += 1;
      notify.push({ title, body, symbol: e.symbol });
    }
  }
  if (notify.length > 0) {
    try {
      await dispatchPortfolioDeskEventsToSlack(portfolioIdHex, notify);
    } catch (error) {
      console.warn("[notifications/slack] price alert dispatch failed", {
        portfolioIdPrefix: portfolioIdHex.slice(0, 8),
        count: notify.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return created;
}
