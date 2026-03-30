import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PortfolioPositionQuickAdd } from "@/app/portfolio/ui/portfolio-position-quick-add";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { getDefaultPortfolio, listPortfolioAccounts, provisionDefaultPortfolioForUser } from "@/modules/core-admin/repository";
import type { Account } from "@/modules/core-admin/types";

export default async function AddHoldingsPage({
  params
}: {
  params: Promise<{ accountId: string }>;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio");
  }

  const { accountId } = await params;

  let portfolio = await getDefaultPortfolio(session.userId, { tenantId: session.tenantId });
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

  const portfolioIdHex = portfolio._id.toHexString();

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
      `[portfolio/add-holdings] accounts load failed userId=${session.userId} portfolioId=${portfolioIdHex} detail=${detail}`
    );
    notFound();
  }

  const account = accounts.find((a) => a._id?.toHexString() === accountId);
  if (!account?._id) {
    notFound();
  }

  const accountOptions = [
    {
      id: account._id.toHexString(),
      name: account.name,
      brokerType: account.type
    }
  ];

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Portfolio" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
          <div className="portfolio-overview">
            <header className="portfolio-hero portfolio-hero--account-edit xf-noise-overlay">
              <p className="portfolio-hero__eyebrow">
                <Link className="portfolio-breadcrumb-link" href="/portfolio">
                  Portfolio
                </Link>
                <span aria-hidden> · </span>
                <Link className="portfolio-breadcrumb-link" href={`/portfolio/accounts/${accountId}`}>
                  {account.name}
                </Link>
                <span aria-hidden> · </span>
                <span>Add holdings</span>
              </p>
              <h1 className="portfolio-hero__title">Add positions</h1>
              <p className="portfolio-hero__sub">
                Positions post to this account. When done, return to{" "}
                <Link className="portfolio-table-link" href="/portfolio">
                  portfolio overview
                </Link>{" "}
                or{" "}
                <Link className="portfolio-table-link" href={`/portfolio/accounts/${accountId}`}>
                  edit account
                </Link>
                .
              </p>
            </header>

            <PortfolioPositionQuickAdd
              portfolioId={portfolioIdHex}
              accounts={accountOptions}
              lockedAccountId={account._id.toHexString()}
            />
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
