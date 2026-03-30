/**
 * When switching books from the portfolio list rail, preserve the current tool path
 * (e.g. stay on Watchlist when picking another portfolio).
 */
export function buildAdminPortfolioSwitchHref(pathname: string | null, newPortfolioId: string): string {
  const raw = pathname ?? "";
  const segments = raw.split("/").filter(Boolean);
  const i = segments.indexOf("portfolios");
  if (i === -1 || segments[i + 1] === undefined) {
    return `/admin/portfolios/${encodeURIComponent(newPortfolioId)}/accounts`;
  }
  const next = segments.slice();
  next[i + 1] = newPortfolioId;
  return `/${next.map((s) => encodeURIComponent(s)).join("/")}`;
}
