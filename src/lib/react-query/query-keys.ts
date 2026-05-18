export const watchlistQueryKeys = {
  all: ["watchlist"] as const,
  portfolio: (portfolioId: string) => [...watchlistQueryKeys.all, portfolioId] as const,
  detail: (portfolioId: string, queryString: string) =>
    [...watchlistQueryKeys.portfolio(portfolioId), queryString] as const
};

export const xchatTokenStatsQueryKeys = {
  all: ["xchat-token-stats"] as const
};

export const symbolQuotesQueryKeys = {
  all: ["symbol-quotes"] as const,
  list: (symbolsKey: string, portfolioIdHex: string) =>
    [...symbolQuotesQueryKeys.all, symbolsKey, portfolioIdHex] as const
};

export const watchlistHotQueryKeys = {
  all: ["watchlist-hot"] as const,
  compact: (portfolioId: string | null, limit: number) =>
    [...watchlistHotQueryKeys.all, portfolioId ?? "", String(limit)] as const
};

export const workspacePulseQueryKeys = {
  all: ["workspace-pulse"] as const,
  pulse: (holdingsKey: string) => [...workspacePulseQueryKeys.all, holdingsKey] as const
};

export const adminManageUsersQueryKeys = {
  directory: ["admin-manage-users-directory"] as const
};
