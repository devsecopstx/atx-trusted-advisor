import {
    fireAndForgetArchiveAdvisorSystemAdvice,
    resolvePortfolioOwnerForAdviceArchive
} from "@/modules/compliance/advisor-advice-events";
import {
    adminCreatePortfolioAlert,
    adminHasRecentPriceAlertForSymbol
} from "@/modules/core-admin/repository";
import type { WatchlistSymbol } from "@/modules/core-admin/types";
import { dispatchPortfolioDeskEvents } from "@/modules/notifications/portfolio-notification-service";
import {
    DEFAULT_MIN_ABS_MOVE_PERCENT,
    DEFAULT_PRICE_ALERT_COOLDOWN_MS,
    MAX_USER_MOVE_PERCENT,
    MIN_USER_MOVE_PERCENT
} from "@/modules/watchlist/price-alert-constants";
import { symbolFromRawWatchlistEntry } from "@/modules/watchlist/watchlist-row-raw";

export {
    DEFAULT_MIN_ABS_MOVE_PERCENT,
    DEFAULT_PRICE_ALERT_COOLDOWN_MS,
    MAX_USER_MOVE_PERCENT,
    MIN_USER_MOVE_PERCENT
} from "@/modules/watchlist/price-alert-constants";

export type WatchlistPriceTick = {
  symbol: string;
  /** New price after quote refresh; omit when the scan only updated rationale. */
  lastPrice?: number;
  /** When set, compare prior `lastPrice` on that `symbolsBefore` row (duplicate tickers). */
  symbolRowIndex?: number;
};

function normWatchlistSymbolKey(symbol: string): string {
  return String(symbol).trim().toUpperCase();
}

function asWatchlistSymbolForPriceAlert(raw: unknown, symbol: string): WatchlistSymbol {
  if (typeof raw === "string") {
    return { symbol, addedAt: new Date() };
  }
  if (raw && typeof raw === "object") {
    return raw as WatchlistSymbol;
  }
  return { symbol, addedAt: new Date() };
}

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
  /** Raw `portfolio_watchlists.symbols` rows (structured and/or legacy string tickers). */
  symbolsBefore: ReadonlyArray<unknown>,
  priceUpdates: ReadonlyArray<WatchlistPriceTick>,
  minAbsMovePercent: number = DEFAULT_MIN_ABS_MOVE_PERCENT
): PriceMoveEvaluation[] {
  const out: PriceMoveEvaluation[] = [];
  for (const u of priceUpdates) {
    let before: WatchlistSymbol | undefined;
    if (typeof u.symbolRowIndex === "number") {
      const raw = symbolsBefore[u.symbolRowIndex];
      const key = raw !== undefined ? symbolFromRawWatchlistEntry(raw) : null;
      if (key && normWatchlistSymbolKey(key) === normWatchlistSymbolKey(u.symbol)) {
        before = asWatchlistSymbolForPriceAlert(raw, key);
      }
    }
    if (!before) {
      for (const s of symbolsBefore) {
        const k = symbolFromRawWatchlistEntry(s);
        if (k && normWatchlistSymbolKey(k) === normWatchlistSymbolKey(u.symbol)) {
          before = asWatchlistSymbolForPriceAlert(s, k);
          break;
        }
      }
    }
    if (u.lastPrice === undefined || !Number.isFinite(u.lastPrice)) {
      continue;
    }
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
  const portfolioOwner = await resolvePortfolioOwnerForAdviceArchive(portfolioIdHex);
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
      if (portfolioOwner) {
        fireAndForgetArchiveAdvisorSystemAdvice({
          tenantId: portfolioOwner.tenantId,
          userId: portfolioOwner.userId,
          surface: "portfolio_alert",
          artifactKind: "portfolio_alert",
          prompt: title,
          responseText: body,
          responsePayload: {
            alertId: row._id?.toHexString() ?? null,
            changePct: e.changePct,
            newPrice: e.newPrice
          },
          metadata: { source: "watchlist_price_scanner", severity: "info" }
        });
      }
    }
  }
  if (notify.length > 0) {
    try {
      await dispatchPortfolioDeskEvents(portfolioIdHex, notify);
    } catch (error) {
      console.warn("[notifications/desk] price alert dispatch failed", {
        portfolioIdPrefix: portfolioIdHex.slice(0, 8),
        count: notify.length,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { created, recorded, skippedCooldown };
}
