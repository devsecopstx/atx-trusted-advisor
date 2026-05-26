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
