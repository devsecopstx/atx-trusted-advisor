import Link from "next/link";
import { redirect } from "next/navigation";

import { PortfolioPositionQuickAdd } from "@/app/portfolio/ui/portfolio-position-quick-add";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    listPortfolioAccounts,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { Account } from "@/modules/core-admin/types";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import "../xchat/xchat.css";

function formatBrokerType(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default async function PortfolioPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio");
  }

  let portfolio: Awaited<ReturnType<typeof getDefaultPortfolio>> = null;
  let accounts: Account[] = [];
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
      "Could not load your default portfolio. Try a hard refresh once after deploy; if it persists, check Cloud Run logs for MongoDB, index creation, or duplicate-key errors.";
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
        "Linked accounts could not be loaded. Refresh the page; your portfolio above should still be valid.";
    }
  }

  const admin = isGlobalAdmin(session.roles);
  const portfolioIdHex = portfolio?._id?.toHexString?.() ?? null;
  const quickAddAccounts = accounts
    .filter((account): account is Account & { _id: NonNullable<Account["_id"]> } => Boolean(account._id))
    .map((account) => ({
      id: account._id.toHexString(),
      name: account.name,
      brokerType: account.type
    }));

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Portfolio" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay" style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p className="eyebrow">Portfolio</p>
          <h1 className="hero-title">Default portfolio</h1>
          <p className="hero-copy">
            Your provisioned default portfolio, linked accounts (broker type), and watchlist context for
            xFinance execution surfaces.
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
                  <code
                    style={{
                      fontSize: "0.85em",
                      wordBreak: "break-all",
                      color: "var(--xf-text-300)",
                      fontFamily: "ui-monospace, monospace"
                    }}
                  >
                    {portfolioIdHex}
                  </code>
                </li>
              ) : null}
            </ul>
          ) : !portfolioLoadError ? (
            <p className="status-text status-warn" style={{ marginTop: "1rem" }}>
              No default portfolio found yet. It is created when your account is approved and bootstrapped.
            </p>
          ) : null}

          {!portfolioLoadError && portfolio?._id ? (
            <div style={{ marginTop: "1.25rem" }}>
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  margin: "1.25rem 0 0.5rem",
                  color: "var(--xf-text-100)"
                }}
              >
                Accounts
              </h2>
              {accountsLoadError ? (
                <p className="status-text status-error">{accountsLoadError}</p>
              ) : accounts.length === 0 ? (
                <p className="status-text">No linked accounts yet.</p>
              ) : (
                <>
                  <div className="crud-table-wrap">
                    <table className="crud-table">
                      <thead>
                        <tr>
                          <th scope="col">Account</th>
                          <th scope="col">Broker type</th>
                          <th scope="col">Reference</th>
                          <th scope="col">Cash</th>
                          <th scope="col">Holdings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((account) => (
                          <tr key={account._id?.toHexString() ?? account.extAccountId}>
                            <td>
                              {account.name}
                              {account.isDefault ? (
                                <span
                                  className="status-text"
                                  style={{ marginLeft: "0.35rem", fontSize: "0.75rem", display: "inline" }}
                                >
                                  (default)
                                </span>
                              ) : null}
                            </td>
                            <td>{formatBrokerType(account.type)}</td>
                            <td>
                              <code
                                style={{
                                  fontSize: "0.8em",
                                  color: "var(--xf-text-300)",
                                  fontFamily: "ui-monospace, monospace"
                                }}
                              >
                                {account.extAccountId || "—"}
                              </code>
                            </td>
                            <td
                              style={{
                                color: "var(--xf-text-300)",
                                fontFamily: "ui-monospace, monospace",
                                fontSize: "0.9rem"
                              }}
                            >
                              {(account.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE).toLocaleString("en-US", {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0
                              })}
                            </td>
                            <td>
                              {account._id ? (
                                <Link
                                  className="cta cta-secondary"
                                  style={{
                                    fontSize: "0.8rem",
                                    padding: "0.35rem 0.65rem",
                                    display: "inline-block"
                                  }}
                                  href={`/portfolio/accounts/${account._id.toHexString()}`}
                                >
                                  Select &amp; edit
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {portfolioIdHex ? (
                    <PortfolioPositionQuickAdd portfolioId={portfolioIdHex} accounts={quickAddAccounts} />
                  ) : null}
                </>
              )}
            </div>
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
