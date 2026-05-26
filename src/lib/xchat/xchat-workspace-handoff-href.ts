/** Portfolio-scoped product handoffs from xChat (xOptions / xStrategyBuilder). */
export function xchatWorkspaceHandoffHref(
  basePath: "/xoptions" | "/xstrategybuilder",
  portfolioId?: string | null
): string {
  const pid = portfolioId?.trim();
  if (!pid) {
    return basePath;
  }
  return `${basePath}?portfolioId=${encodeURIComponent(pid)}`;
}

/** Same as {@link xchatWorkspaceHandoffHref} but preserves an existing query string on `pathWithQuery`. */
export function xchatWorkspaceHandoffAppendPortfolio(
  pathWithQuery: string,
  portfolioId?: string | null
): string {
  const pid = portfolioId?.trim();
  if (!pid) {
    return pathWithQuery;
  }
  const sep = pathWithQuery.includes("?") ? "&" : "?";
  return `${pathWithQuery}${sep}portfolioId=${encodeURIComponent(pid)}`;
}
