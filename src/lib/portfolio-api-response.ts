import type { SessionUser } from "@/lib/auth";
import {
    DEFAULT_EXT_BROKER_REF,
    listPortfolioAccounts
} from "@/modules/core-admin/repository";
import {
    scoringFactorsPayloadForAdminApi,
    type PortfolioScoringFactorApi
} from "@/modules/core-admin/scoring-factors";
import { getTenantPortfolioOrgKey } from "@/modules/core-admin/tenant-portfolio-org";
import type { Portfolio } from "@/modules/core-admin/types";

const DEFAULT_COALESCE_CASH = 25_000;

/** Mongo / legacy docs may omit dates or store BSON as plain objects — never throw on summary build. */
function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * xfinance-strategy–aligned portfolio summary: `Portfolio` + `Account[]` with
 * `riskLevel` / `strategy` placeholders until desk profiles are persisted.
 */
export async function buildPortfolioSummaryPayload(
  session: SessionUser,
  portfolio: Portfolio
): Promise<{
  _id: string;
  name: string;
  accounts: Array<{
    _id?: string;
    name: string;
    accountRef: string;
    brokerType: string;
    balance: number;
    riskLevel: "low" | "medium" | "high";
    strategy: "growth" | "income" | "balanced" | "aggressive";
    positions: unknown[];
    recommendations: unknown[];
  }>;
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  userId: string;
  isDefault: boolean;
  ext_broker_ref: string;
  tenantPortfolioOrgKey: string;
  createdAt: string;
  updatedAt: string;
  /** Effective book-level ranking weights (resolved defaults + catalog copy). Read-only for app users. */
  scoringFactors: PortfolioScoringFactorApi[];
}> {
  if (!portfolio._id) {
    throw new Error("Portfolio missing id");
  }
  const portfolioId = portfolio._id.toHexString();
  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });

  const userId =
    typeof portfolio.userId === "string" && portfolio.userId.length > 0 ? portfolio.userId : session.userId;

  const { scoringFactors } = scoringFactorsPayloadForAdminApi(portfolio.scoringFactors);

  return {
    _id: portfolioId,
    name: portfolio.name?.length ? portfolio.name : "Default Portfolio",
    accounts: accounts.map((account) => ({
      _id: account._id?.toHexString(),
      name: account.name ?? "Account",
      accountRef: account.extAccountId ?? "",
      brokerType: account.type ?? "fidelity",
      balance: account.cashBalance ?? DEFAULT_COALESCE_CASH,
      riskLevel: "medium",
      strategy: "balanced",
      positions: [],
      recommendations: []
    })),
    totalValue: 0,
    dailyChange: 0,
    dailyChangePercent: 0,
    userId,
    isDefault: Boolean(portfolio.isDefault),
    ext_broker_ref: portfolio.ext_broker_ref ?? DEFAULT_EXT_BROKER_REF,
    tenantPortfolioOrgKey: portfolio.tenantPortfolioOrgKey ?? getTenantPortfolioOrgKey(),
    createdAt: toIsoTimestamp(portfolio.createdAt),
    updatedAt: toIsoTimestamp(portfolio.updatedAt),
    scoringFactors
  };
}
