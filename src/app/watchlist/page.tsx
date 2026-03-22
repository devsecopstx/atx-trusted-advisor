import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import {
    getDefaultPortfolio,
    getPortfolioWatchlist,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";
import "../xchat/xchat.css";

import { WatchlistConsole } from "./ui/watchlist-console";
import "./watchlist.css";

export default async function WatchlistPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/watchlist");
  }

  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  let portfolio: Awaited<ReturnType<typeof getDefaultPortfolio>> = null;
  let workspaceError: string | null = null;

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
    const wlDetail = caughtErrorMessage(error);
    console.error(
      `[watchlist] default portfolio load or provision failed userId=${session.userId} tenantId=${session.tenantId} detail=${wlDetail}`
    );
    workspaceError =
      "Could not open your watchlist workspace (default portfolio). Use Sync to create defaults, or open Portfolio.";
  }

  const portfolioId = portfolio?._id?.toHexString() ?? null;

  if (portfolioId && !workspaceError) {
    try {
      const watchlist = await getPortfolioWatchlist({
        userId: session.userId,
        tenantId: session.tenantId,
        portfolioId
      });
      if (!watchlist || (watchlist.symbols?.length ?? 0) === 0) {
        await provisionDefaultPortfolioForUser({
          userId: session.userId,
          tenantId: session.tenantId,
          watchlistSymbols: ["TSLA"]
        });
      }
    } catch (error) {
      const seedDetail = caughtErrorMessage(error);
      console.warn(
        `[watchlist] watchlist seed provision non-fatal userId=${session.userId} portfolioId=${portfolioId} detail=${seedDetail}`
      );
    }
  }

  const admin = isGlobalAdmin(session.roles);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="watchlist" feedbackPageLabel="Watchlist" session={session} />

      <div className="xchat-body" style={{ padding: 0 }}>
        {workspaceError || !portfolioId ? (
          <div className="hero-card xf-noise-overlay" style={{ maxWidth: "640px", margin: "1rem auto", padding: "1rem" }}>
            <p className="eyebrow">Watchlist</p>
            <h1 className="hero-title" style={{ fontSize: "1.25rem" }}>
              Workspace unavailable
            </h1>
            {workspaceError ? (
              <p className="status-text status-error" style={{ marginTop: "0.75rem" }}>
                {workspaceError}
              </p>
            ) : (
              <p className="status-text status-warn" style={{ marginTop: "0.75rem" }}>
                No default portfolio is linked yet. Use Sync to provision it, or open Portfolio.
              </p>
            )}
            <SyncDefaultPortfolioButton />
            <div className="cta-row" style={{ marginTop: "1rem" }}>
              <Link className="cta cta-secondary" href="/portfolio">
                Open Portfolio
              </Link>
              <Link className="cta cta-secondary" href="/">
                Home
              </Link>
            </div>
          </div>
        ) : (
          <WatchlistConsole isAdmin={admin} portfolioId={portfolioId} />
        )}
      </div>
      <GlobalFooter />
    </div>
  );
}
