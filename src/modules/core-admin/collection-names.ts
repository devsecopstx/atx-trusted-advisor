/**
 * MongoDB collection for per-user portfolio documents (singular collection name).
 * Legacy names: `portfolio_portfolios`, brief plural `tenant_portfolios` — run
 * `npm run migrate:tenant-portfolio` once per database.
 */
export const TENANT_PORTFOLIO_COLLECTION = "tenant_portfolio";
