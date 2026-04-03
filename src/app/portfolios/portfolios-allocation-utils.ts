import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

export type AllocationBarSlice = {
  key: string;
  label: string;
  percent: number;
  valueUsd: number;
};

export function accountSlicesForPortfolio(
  portfolioId: string,
  slices: readonly WorkspaceDashboardAccountSlice[]
): WorkspaceDashboardAccountSlice[] {
  return slices.filter((s) => s.portfolioId === portfolioId);
}

export function buildPortfolioAllocationBarSlices(
  portfolioId: string,
  slices: readonly WorkspaceDashboardAccountSlice[]
): { total: number; barSlices: AllocationBarSlice[] } {
  const accountSlices = accountSlicesForPortfolio(portfolioId, slices);
  const total = accountSlices.reduce((s, x) => s + Math.max(0, x.valueUsd), 0);
  const safe = total > 0 ? total : 1;
  const barSlices = accountSlices.map((x) => ({
    key: `${portfolioId}-${x.accountId}`,
    label: x.accountName,
    percent: (Math.max(0, x.valueUsd) / safe) * 100,
    valueUsd: x.valueUsd
  }));
  return { total, barSlices };
}

export function buildAllAccountsBarSlices(accountSlices: readonly WorkspaceDashboardAccountSlice[]): {
  totalUsd: number;
  barSlices: AllocationBarSlice[];
} {
  const totalUsd = accountSlices.reduce((s, x) => s + Math.max(0, x.valueUsd), 0);
  const safe = totalUsd > 0 ? totalUsd : 1;
  const sorted = [...accountSlices].sort((a, b) => b.valueUsd - a.valueUsd);
  const barSlices = sorted.map((x) => {
    const label = `${x.accountName} · ${x.portfolioName}`;
    const pct = (Math.max(0, x.valueUsd) / safe) * 100;
    return {
      key: `${x.portfolioId}-${x.accountId}`,
      label,
      percent: pct,
      valueUsd: x.valueUsd
    };
  });
  return { totalUsd, barSlices };
}
