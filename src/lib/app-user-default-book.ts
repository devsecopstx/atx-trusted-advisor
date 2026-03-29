import type { SessionUser } from "@/lib/auth";
import { getDefaultPortfolio, listPortfolioAccounts } from "@/modules/core-admin/repository";

export type AppUserWorkspaceAccountRef = {
  id: string;
  name: string;
  isDefault: boolean;
};

/** Default portfolio + default/first account for the signed-in user (admin-provisioned defaults in Mongo). */
export type AppUserDefaultBook = {
  portfolioName: string;
  accountName: string;
  portfolioId: string;
  accountId: string | null;
  /** All custodian accounts in the default portfolio — for workspace account picker. */
  accounts: AppUserWorkspaceAccountRef[];
};

export async function loadAppUserDefaultBook(session: SessionUser): Promise<AppUserDefaultBook | null> {
  const portfolio = await getDefaultPortfolio(session.userId, { tenantId: session.tenantId });
  if (!portfolio?._id) {
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
    accounts: accountRefs
  };
}
