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
import type { AccountOutlook, Portfolio } from "@/modules/core-admin/types";

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

function riskLevelFromProfile(
  rp: "conservative" | "balanced" | "growth" | null | undefined
): "low" | "medium" | "high" {
  if (rp === "conservative") return "low";
  if (rp === "growth") return "high";
  return "medium";
}

function strategyFromOutlook(
  outlook: AccountOutlook | null | undefined
): "growth" | "income" | "balanced" | "aggressive" {
  if (outlook === "growth" || outlook === "income" || outlook === "balanced" || outlook === "aggressive") {
    return outlook;
  }
  return "balanced";
}

/**
 * xfinance-strategy–aligned portfolio summary: `Portfolio` + `Account[]` with
 * desk `riskProfile` / `outlook` when persisted; `riskLevel` / `strategy` mirror them for API consumers.
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
    isDefault: boolean;
    riskProfile: "conservative" | "balanced" | "growth" | null;
    outlook: AccountOutlook | null;
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
    accounts: accounts.map((account) => {
      const riskProfile = account.riskProfile ?? null;
      const outlook = account.outlook ?? null;
      return {
        _id: account._id?.toHexString(),
        name: account.name ?? "Account",
        accountRef: account.extAccountId ?? "",
        brokerType: account.type ?? "fidelity",
        balance: account.cashBalance ?? DEFAULT_COALESCE_CASH,
        isDefault: account.isDefault === true,
        riskProfile,
        outlook,
        riskLevel: riskLevelFromProfile(riskProfile),
        strategy: strategyFromOutlook(outlook),
        positions: [],
        recommendations: []
      };
    }),
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
