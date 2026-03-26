import Link from "next/link";
import { redirect } from "next/navigation";

import { PortfolioOverview } from "@/app/portfolio/ui/portfolio-overview";
import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { computePortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { Account, Position } from "@/modules/core-admin/types";
import { isGlobalAdmin } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio");
  }

  let portfolio: Awaited<ReturnType<typeof getDefaultPortfolio>> = null;
  let accounts: Account[] = [];
  let allPositions: Position[] = [];
  let portfolioLoadError: string | null = null;
  let accountsLoadError: string | null = null;

  try {
    portfolio = await getDefaultPortfolio(session.userId, { tenantId: session.tenantId });
    if (!portfolio?._id) {
      const provisioned = await provisionDefaultPortfolioForUser({
        userId: session.userId,
        tenantId: session.tenantId,
        watchlistSymbols: ["TSLA"]
      });
      portfolio = provisioned.portfolio;
    }
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[portfolio] default portfolio load or provision failed userId=${session.userId} tenantId=${session.tenantId} detail=${detail}`
    );
    portfolioLoadError =
      "We couldn't load or create your default portfolio yet. Use Sync to provision your default portfolio, paper account, and watchlist (idempotent).";
  }

  if (portfolio?._id && !portfolioLoadError) {
    try {
      accounts = await listPortfolioAccounts({
        userId: session.userId,
        portfolioId: portfolio._id.toHexString(),
        tenantId: session.tenantId
      });
      if (accounts.length === 0) {
        await provisionDefaultPortfolioForUser({
          userId: session.userId,
          tenantId: session.tenantId,
          watchlistSymbols: ["TSLA"]
        });
        accounts = await listPortfolioAccounts({
          userId: session.userId,
          portfolioId: portfolio._id.toHexString(),
          tenantId: session.tenantId
        });
      }
    } catch (error) {
      const acctDetail = caughtErrorMessage(error);
      console.error(
        `[portfolio] accounts load or backfill failed userId=${session.userId} portfolioId=${portfolio._id.toHexString()} detail=${acctDetail}`
      );
      accountsLoadError =
        "Linked accounts could not be loaded. Try Sync to repair defaults, or refresh the page.";
    }
    if (accounts.length > 0 && portfolio._id) {
      try {
        const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));
        allPositions = await listPortfolioPositionsByAccount({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioId: portfolio._id.toHexString(),
          accountIds
        });
      } catch (error) {
        const detail = caughtErrorMessage(error);
        console.error(`[portfolio] positions load failed userId=${session.userId} detail=${detail}`);
      }
    }
  }

  const admin = isGlobalAdmin(session.roles);
  const portfolioIdHex = portfolio?._id?.toHexString?.() ?? null;
  const portfolioDisplayName =
    portfolio?.name && portfolio.name.trim().length > 0 ? portfolio.name : "Default portfolio";

  const quickAddAccounts = accounts
    .filter((account): account is Account & { _id: NonNullable<Account["_id"]> } => Boolean(account._id))
    .map((account) => ({
      id: account._id.toHexString(),
      name: account.name,
      brokerType: account.type
    }));

  const metrics =
    portfolioIdHex && accounts.length > 0
      ? computePortfolioOverviewMetrics(allPositions, accounts, DEFAULT_ACCOUNT_CASH_BALANCE)
      : null;

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Portfolio" session={session} />

      <div className="xchat-body portfolio-page-body">
        {portfolioLoadError ? (
          <div className="portfolio-overview">
            <section className="portfolio-hero xf-noise-overlay">
              <p className="portfolio-hero__eyebrow">Portfolio</p>
              <h1 className="portfolio-hero__title">Portfolio unavailable</h1>
              <p className="status-text status-error" style={{ margin: "0.75rem 0 0" }}>
                {portfolioLoadError}
              </p>
              <div className="portfolio-hero__toolbar" style={{ marginTop: "1rem" }}>
                <SyncDefaultPortfolioButton />
              </div>
            </section>
          </div>
        ) : null}

        {!portfolioLoadError && portfolio && !portfolioIdHex ? (
          <div className="portfolio-overview">
            <section className="portfolio-hero xf-noise-overlay">
              <p className="portfolio-hero__eyebrow">Portfolio</p>
              <h1 className="portfolio-hero__title">Portfolio</h1>
              <p className="status-text status-warn" style={{ margin: "0.75rem 0 0" }}>
                No default portfolio is linked yet. Use Sync to create your default portfolio, account, and
                watchlist.
              </p>
              <div className="portfolio-hero__toolbar" style={{ marginTop: "1rem" }}>
                <SyncDefaultPortfolioButton />
              </div>
              <div className="cta-row" style={{ marginTop: "1rem" }}>
                <Link className="cta cta-secondary" href="/">
                  Home
                </Link>
              </div>
            </section>
          </div>
        ) : null}

        {!portfolioLoadError && portfolioIdHex && accountsLoadError ? (
          <div className="portfolio-overview">
            <section className="portfolio-hero xf-noise-overlay">
              <p className="portfolio-hero__eyebrow">Portfolio</p>
              <h1 className="portfolio-hero__title">{portfolioDisplayName}</h1>
              <p className="status-text status-error" style={{ margin: "0.75rem 0 0" }}>
                {accountsLoadError}
              </p>
              <div className="portfolio-hero__toolbar" style={{ marginTop: "1rem" }}>
                <SyncDefaultPortfolioButton variant="secondary" />
              </div>
            </section>
          </div>
        ) : null}

        {!portfolioLoadError && portfolioIdHex && !accountsLoadError && accounts.length === 0 ? (
          <div className="portfolio-overview">
            <section className="portfolio-hero xf-noise-overlay">
              <p className="portfolio-hero__eyebrow">Portfolio</p>
              <h1 className="portfolio-hero__title">{portfolioDisplayName}</h1>
              <p className="status-text" style={{ margin: "0.75rem 0 0" }}>
                No linked accounts yet.
              </p>
              <p className="hero-copy" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                If this persists after a moment, use Sync to repair defaults.
              </p>
              <div className="portfolio-hero__toolbar" style={{ marginTop: "1rem" }}>
                <SyncDefaultPortfolioButton variant="secondary" />
              </div>
            </section>
          </div>
        ) : null}

        {!portfolioLoadError && portfolioIdHex && !accountsLoadError && accounts.length > 0 && metrics ? (
          <PortfolioOverview
            admin={admin}
            accounts={accounts}
            metrics={metrics}
            portfolioDisplayName={portfolioDisplayName}
            portfolioIdHex={portfolioIdHex}
            quickAddAccounts={quickAddAccounts}
          />
        ) : null}
      </div>
    </div>
  );
}
