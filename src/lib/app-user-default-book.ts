import type { SessionUser } from "@/lib/auth";
import { getDefaultPortfolio, listPortfolioAccounts } from "@/modules/core-admin/repository";

/** Default portfolio + default/first account for the signed-in user (admin-provisioned defaults in Mongo). */
export type AppUserDefaultBook = {
  portfolioName: string;
  accountName: string;
  portfolioId: string;
  accountId: string | null;
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

  return {
    portfolioName,
    accountName,
    portfolioId: portfolio._id.toHexString(),
    accountId: defaultAccount?._id ? defaultAccount._id.toHexString() : null
  };
}
