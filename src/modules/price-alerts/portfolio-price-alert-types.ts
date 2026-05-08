import type { ObjectId } from "mongodb";

import type { PriceAlertRuleKind } from "@/modules/price-alerts/price-alert-cross-eval";

export type PortfolioPriceAlertStatus = "active" | "fired" | "expired" | "deleted";

export type PortfolioPriceAlertDoc = {
  _id?: ObjectId;
  tenantId?: ObjectId;
  /** Session user id (hex string; legacy rows may use ObjectId in other collections). */
  userId: string;
  portfolioId: ObjectId;
  portfolioName?: string;
  symbol: string;
  symbolNorm: string;
  targetPriceUsd: number;
  ruleKind: PriceAlertRuleKind;
  lastReferencePrice?: number;
  /** Cooldown anchor after a fired desk notification (same window as watchlist price alerts when unset). */
  lastTriggeredAt?: Date;
  status: PortfolioPriceAlertStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Auto-expire (30d from creation in product policy). */
  expiresAt: Date;
  firedAt?: Date;
};
