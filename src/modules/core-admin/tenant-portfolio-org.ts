/**
 * Logical org bucket for this deployment: all app_user portfolios are tagged with this key
 * (MSP / atxfinance-core-app instance). Distinct from `core_tenants` ObjectId scope.
 */
export const DEFAULT_TENANT_PORTFOLIO_ORG_KEY = "org-atx-finance" as const;

/**
 * Reads `process.env.TENANT_PORTFOLIO_ORG_KEY` only (not `getEnv()`) so repository paths stay usable
 * in tests and scripts without loading the full app env schema.
 */
export function getTenantPortfolioOrgKey(): string {
  const raw = process.env.TENANT_PORTFOLIO_ORG_KEY;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, 128);
    }
  }
  return DEFAULT_TENANT_PORTFOLIO_ORG_KEY;
}
