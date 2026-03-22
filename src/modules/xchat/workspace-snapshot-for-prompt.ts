import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    DEFAULT_EXT_BROKER_REF,
    getDefaultPortfolio,
    getPortfolioWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";

export type WorkspaceSnapshotContext = {
  userId: string;
  tenantId?: string;
};

/** Keep prompt size bounded; full book via atxfinance positions_snapshot. */
const MAX_POSITION_ROWS_IN_SNAPSHOT = 120;

function positionCountsByAccountId(
  positions: Array<{ accountId: { toHexString: () => string } }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of positions) {
    const id = p.accountId.toHexString();
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

async function resolveDefaultPortfolio(ctx: WorkspaceSnapshotContext) {
  const existing = await getDefaultPortfolio(ctx.userId, { tenantId: ctx.tenantId });
  if (existing?._id) {
    return existing;
  }
  try {
    const { portfolio: provisioned } = await provisionDefaultPortfolioForUser({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    return provisioned;
  } catch {
    return null;
  }
}

/**
 * Loads portfolio, accounts, watchlist, and a capped positions preview server-side
 * before xChat ask / batch model calls. Injected into the system prompt so the model
 * can answer from fresh workspace data without a tool round-trip; atxfinance remains
 * for refresh, full positions, quotes, and tasks.
 */
export async function buildWorkspaceServerSnapshotBlock(
  ctx: WorkspaceSnapshotContext
): Promise<string | null> {
  const portfolio = await resolveDefaultPortfolio(ctx);
  if (!portfolio?._id) {
    return null;
  }

  const portfolioId = portfolio._id.toHexString();
  const accounts = await listPortfolioAccounts({
    userId: ctx.userId,
    portfolioId,
    tenantId: ctx.tenantId
  });

  const accountIds = accounts
    .map((a) => a._id)
    .filter((id): id is NonNullable<(typeof accounts)[0]["_id"]> => Boolean(id));

  const positions =
    accountIds.length > 0
      ? await listPortfolioPositionsByAccount({
          userId: ctx.userId,
          portfolioId,
          accountIds,
          tenantId: ctx.tenantId
        })
      : [];
  const counts = positionCountsByAccountId(positions);

  const watchlist = await getPortfolioWatchlist({
    userId: ctx.userId,
    portfolioId,
    tenantId: ctx.tenantId
  });

  const snapshot = {
    loadedAt: new Date().toISOString(),
    portfolio: {
      id: portfolioId,
      name: portfolio.name,
      isDefault: portfolio.isDefault,
      ext_broker_ref: portfolio.ext_broker_ref ?? DEFAULT_EXT_BROKER_REF,
      totalPositionCount: positions.length
    },
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      extAccountId: a.extAccountId,
      isDefault: a.isDefault,
      cashBalance: a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
      positionCount: a._id ? (counts.get(a._id.toHexString()) ?? 0) : 0
    })),
    positionsPreview: positions.slice(0, MAX_POSITION_ROWS_IN_SNAPSHOT).map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      avgCost: p.avgCost,
      accountId: p.accountId.toHexString()
    })),
    positionsPreviewTruncated: positions.length > MAX_POSITION_ROWS_IN_SNAPSHOT,
    positionsOmittedCount:
      positions.length > MAX_POSITION_ROWS_IN_SNAPSHOT
        ? positions.length - MAX_POSITION_ROWS_IN_SNAPSHOT
        : 0,
    watchlist: watchlist
      ? {
          name: watchlist.name,
          symbols: (watchlist.symbols ?? []).map((s) => ({
            symbol: s.symbol,
            addedAt:
              s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt),
            ...(s.lineType !== undefined ? { lineType: s.lineType } : {}),
            ...(s.strategy !== undefined ? { strategy: s.strategy } : {}),
            ...(s.quantity !== undefined ? { quantity: s.quantity } : {}),
            ...(s.entryPrice !== undefined ? { entryPrice: s.entryPrice } : {})
          }))
        }
      : { error: "no_watchlist" as const }
  };

  const json = JSON.stringify(snapshot);
  return [
    "Workspace snapshot (loaded server-side for this request; data is current as of loadedAt — use the atxfinance tool for a full positions book refresh, market_quote, or task_status if needed):",
    "```json",
    json,
    "```"
  ].join("\n");
}
