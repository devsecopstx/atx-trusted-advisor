import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { getDefaultPortfolio } from "@/modules/core-admin/repository";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import "../xchat/xchat.css";

export default async function XfinancePage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/xfinance");
  }

  let portfolio: Awaited<ReturnType<typeof getDefaultPortfolio>> = null;
  let portfolioLoadError: string | null = null;
  try {
    portfolio = await getDefaultPortfolio(session.userId, { tenantId: session.tenantId });
  } catch (error) {
    console.error("[xfinance] getDefaultPortfolio failed", {
      userId: session.userId,
      message: error instanceof Error ? error.message : String(error)
    });
    portfolioLoadError = "Could not load portfolio data. Check MongoDB and try again.";
  }

  const admin = isGlobalAdmin(session.roles);
  const portfolioIdHex = portfolio?._id?.toHexString?.() ?? null;

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xfinance" feedbackPageLabel="Portfolio / xFinance" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay" style={{ maxWidth: "640px", margin: "0 auto" }}>
          <p className="eyebrow">xFinance</p>
          <h1 className="hero-title">Default portfolio</h1>
          <p className="hero-copy">
            Your provisioned default portfolio, accounts, and watchlist context for atxFinance execution
            surfaces.
          </p>
          {portfolioLoadError ? (
            <p className="status-text status-error" style={{ marginTop: "1rem" }}>
              {portfolioLoadError}
            </p>
          ) : null}
          {portfolio ? (
            <ul className="stack-gap" style={{ listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
              <li>
                <strong>Name:</strong> {portfolio.name}
              </li>
              {portfolioIdHex ? (
                <li>
                  <strong>Portfolio ID:</strong>{" "}
                  <code style={{ fontSize: "0.85em", wordBreak: "break-all" }}>{portfolioIdHex}</code>
                </li>
              ) : null}
            </ul>
          ) : !portfolioLoadError ? (
            <p className="status-text status-warn" style={{ marginTop: "1rem" }}>
              No default portfolio found yet. It is created when your account is approved and bootstrapped.
            </p>
          ) : null}
          <div className="cta-row" style={{ marginTop: "1.25rem" }}>
            <Link className="cta cta-secondary" href="/">
              Home
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
