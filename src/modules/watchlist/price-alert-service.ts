import {
  adminCreatePortfolioAlert,
  adminHasRecentPriceAlertForSymbol
} from "@/modules/core-admin/repository";
import type { WatchlistSymbol } from "@/modules/core-admin/types";
import { dispatchPortfolioDeskEventsToSlack } from "@/modules/notifications/portfolio-notification-service";

/** Default minimum absolute % move vs prior `lastPrice` before creating a portfolio alert. */
export const DEFAULT_MIN_ABS_MOVE_PERCENT = 5;

/** Default cooldown: skip a new alert if one for the same symbol was created within this window. */
export const DEFAULT_PRICE_ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** Clamp per-row minimum move % to a sane range (0.1% – 100%). */
export const MIN_USER_MOVE_PERCENT = 0.1;
export const MAX_USER_MOVE_PERCENT = 100;

export type WatchlistPriceTick = {
  symbol: string;
  lastPrice: number;
};

export type PriceMoveEvaluation = {
  symbol: string;
  newPrice: number;
  changePct: number;
};

function parseCooldownMsFromEnv(): number {
  const raw = process.env.PRICE_ALERT_COOLDOWN_MS;
  if (raw === undefined || raw === "") {
    return DEFAULT_PRICE_ALERT_COOLDOWN_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_PRICE_ALERT_COOLDOWN_MS;
  }
  return n;
}

/** Effective cooldown (ms). Override with `PRICE_ALERT_COOLDOWN_MS` (0 = no cooldown). */
export function getPriceAlertCooldownMs(): number {
  return parseCooldownMsFromEnv();
}

/**
 * Resolve threshold % for a watchlist row: optional per-symbol override, else global default.
 */
export function resolveMinMovePercent(
  row: WatchlistSymbol | undefined,
  defaultMinAbsMovePercent: number
): number {
  const raw = row?.priceAlertMinAbsMovePercent;
  if (raw === undefined || raw === null || Number.isNaN(raw)) {
    return defaultMinAbsMovePercent;
  }
  return Math.min(MAX_USER_MOVE_PERCENT, Math.max(MIN_USER_MOVE_PERCENT, raw));
}

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
    const threshold = resolveMinMovePercent(before, minAbsMovePercent);
    const changePct = Math.abs((u.lastPrice - prev) / prev) * 100;
    if (changePct > threshold) {
      out.push({ symbol: u.symbol, newPrice: u.lastPrice, changePct });
    }
  }
  return out;
}

export type PersistedPriceAlertRow = {
  portfolioId: string;
  symbol: string;
  changePct: number;
  newPrice: number;
};

export type PersistPriceMoveAlertsOptions = {
  /** @default getPriceAlertCooldownMs() */
  cooldownMs?: number;
  /** @default new Date() — for tests */
  now?: Date;
};

export async function persistPriceMoveAlerts(
  portfolioIdHex: string,
  evaluations: ReadonlyArray<PriceMoveEvaluation>,
  options?: PersistPriceMoveAlertsOptions
): Promise<{ created: number; recorded: PersistedPriceAlertRow[]; skippedCooldown: number }> {
  const cooldownMs = options?.cooldownMs ?? getPriceAlertCooldownMs();
  const now = options?.now ?? new Date();
  const since =
    cooldownMs > 0 ? new Date(now.getTime() - cooldownMs) : new Date(0);

  let created = 0;
  let skippedCooldown = 0;
  const recorded: PersistedPriceAlertRow[] = [];
  const notify: Array<{ title: string; body: string; symbol: string }> = [];
  for (const e of evaluations) {
    if (cooldownMs > 0) {
      const recent = await adminHasRecentPriceAlertForSymbol(portfolioIdHex, e.symbol, since);
      if (recent) {
        skippedCooldown += 1;
        continue;
      }
    }
    const title = `${e.symbol} price alert`;
    const body = `Price moved ${e.changePct.toFixed(1)}% to $${e.newPrice}`;
    const row = await adminCreatePortfolioAlert({
      portfolioId: portfolioIdHex,
      title,
      body,
      severity: "info",
      symbol: e.symbol
    });
    if (row) {
      created += 1;
      recorded.push({
        portfolioId: portfolioIdHex,
        symbol: e.symbol,
        changePct: e.changePct,
        newPrice: e.newPrice
      });
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
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { created, recorded, skippedCooldown };
}
