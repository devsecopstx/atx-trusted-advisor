import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";
import type { AccountOutlook } from "@/modules/core-admin/types";

export type XsbWorkspaceAccount = {
  _id?: string;
  name: string;
  accountRef: string;
  brokerType: string;
  balance: number;
  /** True when this row is the portfolio default account (Mongo). */
  isDefault?: boolean;
  riskProfile: "conservative" | "balanced" | "growth" | null;
  outlook: AccountOutlook | null;
};

export type XsbWorkspacePortfolio = {
  _id: string;
  name: string;
  accounts: XsbWorkspaceAccount[];
  isDefault: boolean;
  /** Book-level OptionsStrategyEngine ranking weights (admin-tunable). */
  scoringFactors: PortfolioScoringFactorApi[];
};

export type XsbInitialWorkspace =
  | { status: "ready"; portfolio: XsbWorkspacePortfolio }
  | { status: "error"; message: string };
