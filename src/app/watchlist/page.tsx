import Link from "next/link";
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

  let watchlist = await getPortfolioWatchlist({
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
    watchlist = await getPortfolioWatchlist({
      userId: session.userId,
      tenantId: session.tenantId,
      portfolioId
    });
  }
  const symbols = watchlist?.symbols ?? [];

  const admin = isGlobalAdmin(session.roles);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="watchlist" feedbackPageLabel="Watchlist" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay" style={{ maxWidth: "640px", margin: "0 auto" }}>
          <p className="eyebrow">Watchlist</p>
          <h1 className="hero-title">Symbols & alerts</h1>
          <p className="hero-copy">
            Your default watchlist is auto-healed for legacy users. If missing or empty, it is seeded with
            <strong> TSLA</strong>.
          </p>
          <ul className="stack-gap" style={{ listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
            <li>
              <strong>Watchlist:</strong> {watchlist?.name ?? "DefaultWatchlist"}
            </li>
            <li>
              <strong>Symbols:</strong>{" "}
              {symbols.length > 0 ? symbols.map((item) => item.symbol).join(", ") : "TSLA"}
            </li>
          </ul>
          <div className="cta-row" style={{ marginTop: "1.25rem" }}>
            <Link className="cta cta-secondary" href="/xfinance">
              Back to portfolio
            </Link>
            {admin ? (
              <Link className="cta cta-primary" href="/admin/portfolios">
                Open in admin console
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
