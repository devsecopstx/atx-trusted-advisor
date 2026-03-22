import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountWorkspace } from "@/app/portfolio/accounts/[accountId]/account-workspace";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { Account, Position } from "@/modules/core-admin/types";

import "../../../xchat/xchat.css";

function serializeAccount(account: Account) {
  return {
    _id: account._id!.toHexString(),
    name: account.name,
    type: account.type,
    extAccountId: account.extAccountId,
    cashBalance: account.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: account.isDefault
  };
}

function serializePositions(rows: Position[]) {
  return rows
    .filter((p) => p._id)
    .map((p) => ({
      _id: p._id!.toHexString(),
      symbol: p.symbol,
      qty: p.qty,
      avgCost: p.avgCost
    }));
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
      `[portfolio/account] accounts load failed userId=${session.userId} portfolioId=${portfolioIdHex} detail=${detail}`
    );
    notFound();
  }

  const account = accounts.find((a) => a._id?.toHexString() === accountId);
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

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay" style={{ maxWidth: "720px", margin: "0 auto" }}>
          <p className="eyebrow">
            <Link href="/portfolio" style={{ color: "var(--xf-text-300)", textDecoration: "none" }}>
              My accounts
            </Link>{" "}
            / Manage account
          </p>
          <h1 className="hero-title">{account.name}</h1>
          <p className="hero-copy">
            Edit cash and external reference, then add or adjust stock lots for this account. Saving a lot with
            the same ticker updates the existing row (upsert).
          </p>

          <AccountWorkspace
            portfolioId={portfolioIdHex}
            account={serializeAccount(account)}
            initialPositions={serializePositions(positions)}
          />
        </section>
      </div>
    </div>
  );
}
