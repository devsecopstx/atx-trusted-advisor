import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import {
    getDefaultPortfolio,
    getPortfolioWatchlist,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

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
    throw new Error("Failed to resolve default portfolio for watchlist view");
  }
  const portfolioId = portfolio._id.toHexString();

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

  const admin = isGlobalAdmin(session.roles);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="watchlist" feedbackPageLabel="Watchlist" session={session} />

      <div className="xchat-body" style={{ padding: 0 }}>
        <WatchlistConsole isAdmin={admin} portfolioId={portfolioId} />
      </div>
    </div>
  );
}
