export type PortfolioChildToolLink = {
  path: string;
  label: string;
  typeLabel: string;
  title: string;
};

/**
 * Deep links for portfolio-scoped admin tools (hub + tab destinations).
 * Excludes the tools hub route itself.
 */
export function getPortfolioChildToolLinks(portfolioId: string): PortfolioChildToolLink[] {
  const pid = encodeURIComponent(portfolioId);
  const base = `/admin/portfolios/${pid}`;
  return [
    {
      path: `${base}/accounts`,
      label: "Accounts",
      typeLabel: "Custodian accounts",
      title: "Manage custodian accounts linked to this portfolio book"
    },
    {
      path: `${base}/watchlist`,
      label: "Watchlist",
      typeLabel: "Symbol list",
      title: "Edit portfolio watchlist symbols"
    },
    {
      path: `${base}/alerts`,
      label: "Alerts",
      typeLabel: "Price & notifications",
      title: "Manage alerts for this book"
    },
    {
      path: `${base}/scoring`,
      label: "Scoring",
      typeLabel: "Portfolio scoring weights",
      title: "Edit IV, liquidity, and desk scoring weights"
    },
    {
      path: `${base}/recommendations`,
      label: "Recommendations",
      typeLabel: "Book recommendations",
      title: "View and manage recommendations for this portfolio"
    },
    {
      path: `${base}/delivery-channels`,
      label: "Delivery channels",
      typeLabel: "Channels & routing",
      title: "Delivery channels for this portfolio"
    },
    {
      path: `${base}/broker-import`,
      label: "Broker import",
      typeLabel: "Holdings CSV",
      title: "Import broker holdings CSV locked to this book"
    }
  ];
}

export function portfolioToolsHubHref(portfolioId: string): string {
  return `/admin/portfolios/${encodeURIComponent(portfolioId)}/tools`;
}
