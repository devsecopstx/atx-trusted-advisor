import { ObjectId } from "mongodb";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountWorkspace } from "@/app/portfolio/accounts/[accountId]/account-workspace";
import { serializePositionsForUi } from "@/app/portfolio/lib/serialize-positions";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { resolveActiveWorkspacePortfolioId } from "@/lib/app-user-default-book";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    getPortfolioAccountByIdForSessionUser,
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { parseAccountOutlook, type Account, type Position } from "@/modules/core-admin/types";

function serializeAccount(account: Account) {
  return {
    _id: account._id!.toHexString(),
    name: account.name,
    type: account.type,
    extAccountId: account.extAccountId,
    cashBalance: account.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: account.isDefault,
    brokerImportLocked: Boolean(account.brokerImportLocked),
    riskProfile: account.riskProfile ?? null,
    outlook: parseAccountOutlook(account.outlook) ?? null
  };
}

export default async function PortfolioAccountPage({
  params,
  searchParams
}: {
  params: Promise<{ accountId: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio");
  }

  const { accountId } = await params;
  const viewParam = searchParams ? await searchParams : {};
  const initialWorkspaceView = viewParam.view === "holdings" ? "holdings" : "edit";
  if (!ObjectId.isValid(accountId)) {
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

  let positions: Position[] = [];
  try {
    positions = await listPortfolioPositionsByAccount({
      userId: session.userId,
      tenantId: session.tenantId,
      portfolioId: portfolioIdHex,
      accountIds: [account._id]
    });
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[portfolio/account] positions load failed userId=${session.userId} accountId=${accountId} detail=${detail}`
    );
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Portfolio" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
        <div className="portfolio-account-page portfolio-account-page--edit">
          <header className="portfolio-hero portfolio-hero--account-edit xf-noise-overlay">
            <p className="portfolio-hero__eyebrow portfolio-hero__eyebrow--account-edit-trail" aria-label="Breadcrumb">
              <Link className="portfolio-breadcrumb-link" href="/portfolio">
                Portfolio
              </Link>
              <span className="portfolio-hero__crumb-sep" aria-hidden>
                {" "}
                →{" "}
              </span>
              <span className="portfolio-hero__crumb-portfolio-name">
                {portfolio.name?.trim() || "Default portfolio"}
              </span>
              <span className="portfolio-hero__crumb-sep" aria-hidden>
                {" "}
                →{" "}
              </span>
              <span className="portfolio-hero__crumb-current">Edit account</span>
            </p>
            <h1 className="sr-only">Edit account</h1>
            <p className="portfolio-hero__sub portfolio-hero__sub--account-edit">
              Name, broker desk, initial balance, and outlook for options-income planning.{" "}
              <Link className="portfolio-breadcrumb-link" href={`/portfolio/accounts/${encodeURIComponent(accountId)}?view=holdings`}>
                Holdings
              </Link>{" "}
              for positions.
            </p>
          </header>

          <AccountWorkspace
            portfolioId={portfolioIdHex}
            account={serializeAccount(account)}
            initialPositions={serializePositionsForUi(positions)}
            portfolioAccountCount={accounts.length}
            initialWorkspaceView={initialWorkspaceView}
          />
        </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
