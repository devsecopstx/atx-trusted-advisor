import { parsePortfolioAlertUserPriceRuleMetadata } from "@/lib/portfolio-alert-user-price-rule-metadata";
import {
    adminDeletePortfolioAlert,
    listArmedUserPriceAlertRulesForPortfolio,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";
import { upsertActivePortfolioPriceAlert } from "@/modules/price-alerts/portfolio-price-alerts-repository";

type Aggregated = {
  portfolioIdHex: string;
  portfolioName?: string;
  target: number;
  ruleKind: "above" | "below" | "crosses";
  lastReferencePrice?: number;
  createdAtMs: number;
};

/**
 * Best-effort migration from legacy `portfolio_alerts` NL rows → `portfolio_price_alerts`.
 * Idempotent per symbol (newest armed row wins).
 */
export async function migrateLegacyNlPriceAlertsIfNeeded(input: {
  userId: string;
  tenantId?: string;
}): Promise<{ migratedSymbols: number; deletedLegacy: number }> {
  const portfolios = await listPortfoliosForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId
  });

  let deletedLegacy = 0;
  const bySymbol = new Map<string, Aggregated>();

  for (const pf of portfolios) {
    if (!pf._id) {
      continue;
    }
    const pid = pf._id.toHexString();
    const armed = await listArmedUserPriceAlertRulesForPortfolio(pid);
    for (const row of armed) {
      const meta = parsePortfolioAlertUserPriceRuleMetadata(row.metadata);
      if (!meta || meta.ruleState !== "armed") {
        continue;
      }
      const sym = row.symbol?.trim().toUpperCase();
      if (!sym) {
        continue;
      }
      const createdAtMs =
        row.createdAt instanceof Date ? row.createdAt.getTime() : Date.parse(String(row.createdAt));
      const t = Number.isFinite(createdAtMs) ? createdAtMs : 0;
      const prev = bySymbol.get(sym);
      if (prev && prev.createdAtMs >= t) {
        continue;
      }
      bySymbol.set(sym, {
        portfolioIdHex: pid,
        portfolioName: pf.name,
        target: meta.targetPriceUsd,
        ruleKind: meta.ruleKind,
        lastReferencePrice: meta.lastReferencePrice,
        createdAtMs: t
      });
    }
  }

  if (bySymbol.size === 0) {
    return { migratedSymbols: 0, deletedLegacy: 0 };
  }

  for (const [sym, payload] of bySymbol) {
    await upsertActivePortfolioPriceAlert({
      userId: input.userId,
      tenantId: input.tenantId,
      portfolioIdHex: payload.portfolioIdHex,
      portfolioName: payload.portfolioName,
      symbolUpper: sym,
      targetPriceUsd: payload.target,
      ruleKind: payload.ruleKind,
      preserveLastReference: true,
      seedLastReferencePrice: payload.lastReferencePrice
    });
  }

  for (const pf of portfolios) {
    if (!pf._id) {
      continue;
    }
    const pid = pf._id.toHexString();
    const armed = await listArmedUserPriceAlertRulesForPortfolio(pid);
    for (const row of armed) {
      const id = row._id?.toHexString();
      if (!id) {
        continue;
      }
      const deletedOk = await adminDeletePortfolioAlert(pid, id);
      if (deletedOk) {
        deletedLegacy += 1;
      }
    }
  }

  return { migratedSymbols: bySymbol.size, deletedLegacy };
}
