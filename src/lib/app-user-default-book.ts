import { ObjectId } from "mongodb";
import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/auth";
import { WORKSPACE_PORTFOLIO_COOKIE_NAME } from "@/lib/workspace-portfolio-cookie";
import { listPortfolioAccounts, listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import type { Portfolio } from "@/modules/core-admin/types";

export type AppUserWorkspaceAccountRef = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type AppUserWorkspacePortfolioRef = {
  id: string;
  name: string;
  isDefault: boolean;
};

/** Active portfolio + accounts for the signed-in user (rail, xChat book context, find-options). */
export type AppUserDefaultBook = {
  portfolioName: string;
  accountName: string;
  portfolioId: string;
  accountId: string | null;
  /** All custodian accounts in the active workspace portfolio — for workspace account picker. */
  accounts: AppUserWorkspaceAccountRef[];
  /** All portfolios the user can switch to (rail portfolio dropdown). */
  workspacePortfolios: AppUserWorkspacePortfolioRef[];
};

function portfolioRefs(rows: Portfolio[]): AppUserWorkspacePortfolioRef[] {
  return rows
    .filter((p) => p._id)
    .map((p) => ({
      id: p._id!.toHexString(),
      name: p.name?.trim() || "Portfolio",
      isDefault: Boolean(p.isDefault)
    }));
}

export function resolveChosenPortfolioId(
  workspacePortfolios: AppUserWorkspacePortfolioRef[],
  cookieRaw: string | undefined
): string | null {
  if (workspacePortfolios.length === 0) {
    return null;
  }
  const idSet = new Set(workspacePortfolios.map((p) => p.id));
  const trimmed = cookieRaw?.trim() ?? "";
  if (trimmed && ObjectId.isValid(trimmed) && idSet.has(trimmed)) {
    return trimmed;
  }
  const def = workspacePortfolios.find((p) => p.isDefault);
  return def?.id ?? workspacePortfolios[0]!.id;
}

/** Active workspace portfolio hex id (cookie when valid, else Mongo default or first). */
export async function resolveActiveWorkspacePortfolioId(session: SessionUser): Promise<string | null> {
  const portfolioRows = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  if (portfolioRows.length === 0) {
    return null;
  }
  const workspacePortfolios = portfolioRefs(portfolioRows);
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(WORKSPACE_PORTFOLIO_COOKIE_NAME)?.value;
  return resolveChosenPortfolioId(workspacePortfolios, fromCookie);
}

async function buildDefaultBookForPortfolioRow(
  session: SessionUser,
  portfolio: Portfolio,
  workspacePortfolios: AppUserWorkspacePortfolioRef[]
): Promise<AppUserDefaultBook | null> {
  if (!portfolio._id) {
    return null;
  }

  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId: portfolio._id.toHexString(),
    tenantId: session.tenantId
  });
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];

  const portfolioName =
    portfolio.name && portfolio.name.trim().length > 0 ? portfolio.name.trim() : "Default portfolio";
  const accountName =
    defaultAccount?.name && defaultAccount.name.trim().length > 0
      ? defaultAccount.name.trim()
      : accounts.length === 0
        ? "No linked account"
        : "Account";

  const accountRefs: AppUserWorkspaceAccountRef[] = accounts
    .filter((a) => a._id)
    .map((a) => ({
      id: a._id!.toHexString(),
      name: a.name?.trim() || "Account",
      isDefault: Boolean(a.isDefault)
    }));

  return {
    portfolioName,
    accountName,
    portfolioId: portfolio._id.toHexString(),
    accountId: defaultAccount?._id ? defaultAccount._id.toHexString() : null,
    accounts: accountRefs,
    workspacePortfolios
  };
}

/** Loads the active workspace book: cookie-selected portfolio when valid, else Mongo default (or first). */
export async function loadAppUserDefaultBook(session: SessionUser): Promise<AppUserDefaultBook | null> {
  const portfolioRows = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  if (portfolioRows.length === 0) {
    return null;
  }

  const workspacePortfolios = portfolioRefs(portfolioRows);
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(WORKSPACE_PORTFOLIO_COOKIE_NAME)?.value;
  const chosenId = resolveChosenPortfolioId(workspacePortfolios, fromCookie);

  const portfolio = portfolioRows.find((p) => p._id?.toHexString() === chosenId);
  if (!portfolio?._id) {
    return null;
  }

  return buildDefaultBookForPortfolioRow(session, portfolio, workspacePortfolios);
}

/**
 * Same shape as `loadAppUserDefaultBook` but pinned to an owned portfolio id (e.g. `?portfolioId=` on xChat/watchlist).
 * Returns null when the id is invalid or not in the user's workspace list.
 */
export async function loadAppUserDefaultBookForPortfolioId(
  session: SessionUser,
  portfolioIdHex: string
): Promise<AppUserDefaultBook | null> {
  const trimmed = portfolioIdHex.trim();
  if (!trimmed || !ObjectId.isValid(trimmed)) {
    return null;
  }

  const portfolioRows = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  if (portfolioRows.length === 0) {
    return null;
  }

  const workspacePortfolios = portfolioRefs(portfolioRows);
  const portfolio = portfolioRows.find((p) => p._id?.toHexString() === trimmed);
  if (!portfolio?._id) {
    return null;
  }

  return buildDefaultBookForPortfolioRow(session, portfolio, workspacePortfolios);
}
