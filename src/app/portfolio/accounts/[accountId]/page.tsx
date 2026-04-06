import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";

import { AccountWorkspace } from "@/app/portfolio/accounts/[accountId]/account-workspace";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";
import { resolveActiveWorkspacePortfolioId } from "@/lib/app-user-default-book";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    getPortfolioAccountByIdForSessionUser,
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { parseAccountOutlook, type Account } from "@/modules/core-admin/types";

function serializeAccount(account: Account) {
  const rawRef = (account.extAccountId ?? "").trim();
  const hasExtAccountRef = rawRef.length > 0;
  return {
    _id: account._id!.toHexString(),
    name: account.name,
    type: account.type,
    extAccountRefMasked: maskAccountXrefForDisplay(rawRef),
    hasExtAccountRef,
    cashBalance: account.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: account.isDefault,
    brokerImportLocked: Boolean(account.brokerImportLocked),
    riskProfile: account.riskProfile ?? null,
    outlook: parseAccountOutlook(account.outlook) ?? null
  };
}

export default async function PortfolioAccountPage({
  params
}: {
  params: Promise<{ accountId: string }>;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio");
  }

  const { accountId: accountIdParam } = await params;
  const accountId = normalizeMongoObjectIdParam(accountIdParam);
  if (!accountId || !ObjectId.isValid(accountId)) {
    notFound();
  }

  /** Prefer cookie-selected workspace portfolio, else Mongo default (then provision). Account may live on another portfolio (e.g. `/portfolios?focus=` vs workspace cookie). */
  const workspacePortfolioId = await resolveActiveWorkspacePortfolioId(session);
  let portfolio = workspacePortfolioId
    ? await getPortfolioByIdForSessionUser({
        userId: session.userId,
        tenantId: session.tenantId,
        portfolioId: workspacePortfolioId
      })
    : null;
  if (!portfolio?._id) {
    portfolio = await getDefaultPortfolio(session.userId, { tenantId: session.tenantId });
  }
  if (!portfolio?._id) {
    const provisioned = await provisionDefaultPortfolioForUser({
      userId: session.userId,
      tenantId: session.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    portfolio = provisioned.portfolio;
  }

  if (!portfolio?._id) {
    notFound();
  }

  let portfolioIdHex = portfolio._id.toHexString();

  let accounts: Account[] = [];
  try {
    accounts = await listPortfolioAccounts({
      userId: session.userId,
      portfolioId: portfolioIdHex,
      tenantId: session.tenantId
    });
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[portfolio/account] accounts load failed userId=${session.userId} portfolioId=${portfolioIdHex} detail=${detail}`
    );
    notFound();
  }

  let account = accounts.find((a) => a._id?.toHexString() === accountId);
  if (!account?._id) {
    const direct = await getPortfolioAccountByIdForSessionUser({
      userId: session.userId,
      tenantId: session.tenantId,
      accountId
    });
    if (!direct?._id) {
      notFound();
    }
    const owning = await getPortfolioByIdForSessionUser({
      userId: session.userId,
      tenantId: session.tenantId,
      portfolioId: direct.portfolioId.toHexString()
    });
    if (!owning?._id) {
      notFound();
    }
    portfolio = owning;
    portfolioIdHex = owning._id.toHexString();
    try {
      accounts = await listPortfolioAccounts({
        userId: session.userId,
        portfolioId: portfolioIdHex,
        tenantId: session.tenantId
      });
    } catch (error) {
      const detail = caughtErrorMessage(error);
      console.error(
        `[portfolio/account] accounts load failed userId=${session.userId} portfolioId=${portfolioIdHex} detail=${detail}`
      );
      notFound();
    }
    account = accounts.find((a) => a._id?.toHexString() === accountId) ?? direct;
  }

  if (!account?._id) {
    notFound();
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Portfolio" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
        <div className="portfolio-account-page portfolio-account-page--edit">
          <AccountWorkspace
            portfolioId={portfolioIdHex}
            portfolioName={portfolio.name?.trim() || "Default portfolio"}
            account={serializeAccount(account)}
            portfolioAccountCount={accounts.length}
          />
        </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
