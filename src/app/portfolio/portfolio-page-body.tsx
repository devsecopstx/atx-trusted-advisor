import Link from "next/link";

import { HomeIcon } from "@/app/admin/ui/crud-icons";
import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { serializePositionsForUi } from "@/app/portfolio/lib/serialize-positions";
import type { PortfolioDeskPrefetchStrip } from "@/app/portfolio/ui/portfolio-desk-prefetch";
import { PortfolioOverview } from "@/app/portfolio/ui/portfolio-overview";
import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";
import { resolveActiveWorkspacePortfolioId } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { buildPortfolioHoldingRows } from "@/lib/portfolio-holding-rows";
import { tryIbkrLinkedAccountsSnapshotForSession } from "@/lib/portfolio-ibkr-ssr";
import { computePortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    adminListPortfolioAlerts,
    getDefaultPortfolio,
    getPortfolioByIdForSessionUser,
    getPortfolioWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { scoringFactorsPayloadForAdminApi } from "@/modules/core-admin/scoring-factors";
import type { Account, Position } from "@/modules/core-admin/types";
import { isGlobalAdmin } from "@/modules/identity/authorization";

type Props = {
  session: SessionUser;
};

export async function PortfolioPageBody({ session }: Props) {
  let portfolio: Awaited<ReturnType<typeof getDefaultPortfolio>> = null;
  let accounts: Account[] = [];
  let allPositions: Position[] = [];
  let portfolioLoadError: string | null = null;
  let accountsLoadError: string | null = null;
  let deskPrefetch: PortfolioDeskPrefetchStrip | null = null;

  try {
    const workspacePortfolioId = await resolveActiveWorkspacePortfolioId(session);
    portfolio = workspacePortfolioId
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
      const portfolioIdHex = portfolio._id.toHexString();
      const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));
      const settled = await Promise.allSettled([
        listPortfolioPositionsByAccount({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioId: portfolioIdHex,
          accountIds
        }),
        getPortfolioWatchlist({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioId: portfolioIdHex
        }),
        adminListPortfolioAlerts(portfolioIdHex),
        tryIbkrLinkedAccountsSnapshotForSession(session)
      ]);

      const posR = settled[0];
      const wlR = settled[1];
      const alR = settled[2];
      const ibR = settled[3];

      if (posR.status === "fulfilled") {
        allPositions = posR.value;
      } else {
        const detail = caughtErrorMessage(posR.reason);
        console.error(`[portfolio] positions load failed userId=${session.userId} detail=${detail}`);
      }

      deskPrefetch = {
        watchlistSymbolCount:
          wlR.status === "fulfilled" ? (wlR.value?.symbols?.length ?? 0) : 0,
        activeAlertsCount:
          alR.status === "fulfilled" ? alR.value.filter((a) => a.status === "active").length : 0,
        ibkrLinkedAccountCount:
          ibR.status === "fulfilled" ? (ibR.value?.accountCount ?? null) : null
      };
    }
  }

  const admin = isGlobalAdmin(session.roles);
  const portfolioIdHex = portfolio?._id?.toHexString?.() ?? null;
  const portfolioDisplayName =
    portfolio?.name && portfolio.name.trim().length > 0 ? portfolio.name : "Default portfolio";

  const metrics =
    portfolioIdHex && accounts.length > 0
      ? computePortfolioOverviewMetrics(allPositions, accounts, DEFAULT_ACCOUNT_CASH_BALANCE)
      : null;
  const holdingsRows =
    portfolioIdHex && accounts.length > 0 ? buildPortfolioHoldingRows(accounts, allPositions) : [];

  const positionsByAccount: Record<string, SerializablePosition[]> = {};
  if (allPositions.length > 0) {
    const byHex = new Map<string, Position[]>();
    for (const p of allPositions) {
      const hex = p.accountId.toHexString();
      const list = byHex.get(hex);
      if (list) list.push(p);
      else byHex.set(hex, [p]);
    }
    for (const [hex, list] of byHex) {
      positionsByAccount[hex] = serializePositionsForUi(list);
    }
  }

  const scoringTenantId =
    portfolio && !portfolioLoadError
      ? portfolio.tenantId?.toHexString() ?? session.tenantId
      : null;
  const tenantForScoring = scoringTenantId ? await getTenantByHexIdCached(scoringTenantId) : null;
  const scoringFactors =
    portfolio && !portfolioLoadError
      ? scoringFactorsPayloadForAdminApi(
          portfolio.scoringFactors,
          tenantForScoring?.defaultPortfolioScoringFactors
        ).scoringFactors
      : [];

  return (
    <>
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
              No default portfolio is linked yet. Use Sync to create your default portfolio, account, and watchlist.
            </p>
            <div className="portfolio-hero__toolbar" style={{ marginTop: "1rem" }}>
              <SyncDefaultPortfolioButton />
            </div>
            <div className="cta-row" style={{ marginTop: "1rem" }}>
              <Link className="cta cta-secondary" href="/">
                <HomeIcon className="crud-icon" />
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
          deskPrefetch={deskPrefetch}
          holdingsRows={holdingsRows}
          metrics={metrics}
          portfolioDisplayName={portfolioDisplayName}
          portfolioIdHex={portfolioIdHex}
          positionsByAccount={positionsByAccount}
          scoringFactors={scoringFactors}
        />
      ) : null}
    </>
  );
}
