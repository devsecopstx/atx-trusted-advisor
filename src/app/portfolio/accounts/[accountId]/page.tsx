import { ObjectId } from "mongodb";
import { notFound, redirect } from "next/navigation";

import { AccountWorkspace } from "@/app/portfolio/accounts/[accountId]/account-workspace";
import { serializePositionsForUi } from "@/app/portfolio/lib/serialize-positions";
import { PortfolioWorkspaceProductShell } from "@/app/portfolio/ui/portfolio-workspace-product-shell";
import {
    isProvisioningPortfolioAccountRef,
    maskAccountXrefForDisplay
} from "@/lib/account-xref-display";
import { resolveActiveWorkspacePortfolioId } from "@/lib/app-user-default-book";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { getEnv } from "@/lib/env";
import { getInvestmentOutlookRefreshEnabled } from "@/lib/feature-flags";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { getCoreUserByIdCached, getTenantByHexIdCached } from "@/lib/server-request-cache";
import { effectiveWorkspaceLimitsForTenantAndPlan } from "@/lib/tenant-workspace-limits";
import { getWorkspaceProductSidebarPropsForSession } from "@/lib/workspace-product-sidebar-server-props";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    getPortfolioAccountByIdForSessionUser,
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { parseAccountOutlook, type Account } from "@/modules/core-admin/types";

function serializeAccount(account: Account) {
  const rawRef = (account.extAccountId ?? "").trim();
  const hasExtAccountRef = !isProvisioningPortfolioAccountRef(rawRef);
  return {
    _id: account._id!.toHexString(),
    name: account.name,
    type: account.type,
    extAccountRefMasked: maskAccountXrefForDisplay(rawRef),
    hasExtAccountRef,
    cashBalance: account.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: account.isDefault,
    brokerImportLocked: Boolean(account.brokerImportLocked),
    riskProfile: account.riskProfile ?? null,
    outlook: parseAccountOutlook(account.outlook) ?? null,
    outlookRefreshEnabled: account.outlookRefreshEnabled !== false,
    lastOutlookRefreshAt:
      account.lastOutlookRefreshAt instanceof Date
        ? account.lastOutlookRefreshAt.toISOString()
        : typeof account.lastOutlookRefreshAt === "string"
          ? account.lastOutlookRefreshAt
          : null,
    outlookRefreshSource:
      typeof account.outlookRefreshSource === "string" ? account.outlookRefreshSource : null,
    outlookConfidence:
      typeof account.outlookConfidence === "number" && Number.isFinite(account.outlookConfidence)
        ? account.outlookConfidence
        : null,
    outlookNotes: typeof account.outlookNotes === "string" ? account.outlookNotes : null,
    hnwiGuardrails: account.hnwiGuardrails ?? null
  };
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

  const { accountId: accountIdParam } = await params;
  const accountId = normalizeMongoObjectIdParam(accountIdParam);
  if (!accountId || !ObjectId.isValid(accountId)) {
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

  let initialPositions: ReturnType<typeof serializePositionsForUi> = [];
  try {
    const rows = await listPortfolioPositionsByAccount({
      userId: session.userId,
      tenantId: session.tenantId,
      portfolioId: portfolioIdHex,
      accountIds: [account._id]
    });
    initialPositions = serializePositionsForUi(rows);
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[portfolio/account] positions load failed userId=${session.userId} portfolioId=${portfolioIdHex} accountId=${accountId} detail=${detail}`
    );
  }

  const [workspaceRailProps, workspaceTenant] = await Promise.all([
    getWorkspaceProductSidebarPropsForSession(session, "Portfolio"),
    getWorkspaceTenantHeaderContext(session.tenantId)
  ]);

  const tenantRow =
    ObjectId.isValid(session.tenantId) ? await getTenantByHexIdCached(session.tenantId) : null;
  const coreUser =
    ObjectId.isValid(session.userId) ? await getCoreUserByIdCached(session.userId) : null;
  const workspaceLimits = await effectiveWorkspaceLimitsForTenantAndPlan(
    tenantRow,
    coreUser?.subscriptionPlan
  );
  const investmentOutlookRefreshEnabled = getInvestmentOutlookRefreshEnabled({
    envEnabled: getEnv().INVESTMENT_OUTLOOK_REFRESH_ENABLED === true,
    tenantLimits: workspaceLimits
  });

  return (
    <PortfolioWorkspaceProductShell
      feedbackPageLabel="Portfolio"
      session={session}
      workspaceRailProps={workspaceRailProps}
      workspaceTenant={workspaceTenant}
    >
      <div className="portfolio-account-page portfolio-account-page--edit">
        <AccountWorkspace
          portfolioId={portfolioIdHex}
          portfolioName={portfolio.name?.trim() || "Default portfolio"}
          account={serializeAccount(account)}
          portfolioAccountCount={accounts.length}
          initialPositions={initialPositions}
          investmentOutlookRefreshEnabled={investmentOutlookRefreshEnabled}
        />
      </div>
    </PortfolioWorkspaceProductShell>
  );
}
