import { ObjectId } from "mongodb";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountWorkspace } from "@/app/portfolio/accounts/[accountId]/account-workspace";
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
import {
    formatPositionUsd,
    normalizePositionType,
    parseAccountOutlook,
    type Account,
    type Position
} from "@/modules/core-admin/types";

function serializeAccount(account: Account) {
  return {
    _id: account._id!.toHexString(),
    name: account.name,
    type: account.type,
    extAccountId: account.extAccountId,
    cashBalance: account.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: account.isDefault,
    riskProfile: account.riskProfile ?? null,
    outlook: parseAccountOutlook(account.outlook) ?? null
  };
}

function serializePositions(rows: Position[]) {
  return rows.filter((p) => p._id).map((p) => {
    const t = normalizePositionType(p.type);
    const id = p._id!.toHexString();
    if (t === "stock") {
      return {
        _id: id,
        type: "stock" as const,
        symbol: p.symbol,
        shares: p.qty,
        purchasePrice: p.avgCost
      };
    }
    if (t === "cash") {
      return {
        _id: id,
        type: "cash" as const,
        label: p.symbol,
        amount: p.avgCost,
        amountFormatted: formatPositionUsd(p.avgCost)
      };
    }
    const exp = p.expiration;
    return {
      _id: id,
      type: "option" as const,
      symbol: p.symbol,
      yahooRef: p.yahooRef ?? "",
      optionType: (p.optionType === "put" ? "put" : "call") as "call" | "put",
      strike: p.strike ?? 0,
      expiration: exp ? exp.toISOString().slice(0, 10) : "",
      contracts: p.qty,
      premiumPerContract: p.avgCost
    };
  });
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

  const { accountId } = await params;
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
            <p className="portfolio-hero__eyebrow">
              <Link className="portfolio-breadcrumb-link" href="/portfolio">
                Portfolio
              </Link>
              <span aria-hidden> · </span>
              <span>Edit account</span>
            </p>
            <p className="portfolio-hero__portfolio-readonly" title="This account belongs to this portfolio">
              <span className="portfolio-hero__portfolio-readonly-label">Portfolio</span>
              <span className="portfolio-hero__portfolio-readonly-name">
                {portfolio.name?.trim() || "Default portfolio"}
              </span>
            </p>
            <h1 className="portfolio-hero__title">Account</h1>
            <p className="portfolio-hero__sub">
              Use <strong>Edit account</strong> for name, cash, and desk fields; switch to <strong>Holdings</strong> to
              review positions and add stock, options, or cash.
            </p>
          </header>

          <AccountWorkspace
            portfolioId={portfolioIdHex}
            account={serializeAccount(account)}
            initialPositions={serializePositions(positions)}
            portfolioAccountCount={accounts.length}
          />
        </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
