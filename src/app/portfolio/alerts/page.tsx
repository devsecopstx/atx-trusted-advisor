import { ObjectId } from "mongodb";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FolderPortfolioIcon, HomeIcon } from "@/app/admin/ui/crud-icons";
import {
    PortfolioAlertsInteractive,
    type PortfolioAlertRowVm
} from "@/app/portfolio/alerts/portfolio-alerts-interactive";
import type { PriceRuleRowVm } from "@/app/portfolio/alerts/portfolio-alerts-types";
import { PortfolioWorkspaceProductShell } from "@/app/portfolio/ui/portfolio-workspace-product-shell";
import { resolveActiveWorkspacePortfolioId } from "@/lib/app-user-default-book";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { portfolioAlertRowScannerMetadata } from "@/lib/portfolio-alert-desk-present";
import {
    adminListPortfolioAlerts,
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { canUserLogin } from "@/modules/identity/authorization";
import { getCoreUserById } from "@/modules/identity/repository";
import type { PortfolioPriceAlertDoc } from "@/modules/price-alerts/portfolio-price-alert-types";
import { listActivePortfolioPriceAlertsForUserPortfolio } from "@/modules/price-alerts/portfolio-price-alerts-repository";
import { canManageNlPriceAlerts } from "@/modules/xchat/plan-limits";

import { getWorkspaceProductSidebarPropsForSession } from "@/lib/workspace-product-sidebar-server-props";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";

function mapPriceAlertDocToVm(doc: PortfolioPriceAlertDoc): PriceRuleRowVm {
  return {
    id: doc._id!.toHexString(),
    symbol: doc.symbolNorm,
    ruleKind: doc.ruleKind,
    targetPriceUsd: doc.targetPriceUsd,
    portfolioName: doc.portfolioName?.trim() ? doc.portfolioName.trim() : null,
    lastReferencePrice: doc.lastReferencePrice ?? null,
    status: doc.status,
    expiresAt: doc.expiresAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString()
  };
}

export default async function PortfolioAlertsPage({
  searchParams
}: {
  searchParams: Promise<{ portfolioId?: string | string[] }>;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio/alerts");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const sp = await searchParams;
  const rawPid = sp.portfolioId;
  const requestedRaw =
    typeof rawPid === "string" ? rawPid.trim() : Array.isArray(rawPid) ? rawPid[0]?.trim() ?? "" : "";
  const requested = requestedRaw ? normalizeMongoObjectIdParam(requestedRaw) : "";

  let portfolioId: string | null = null;
  let portfolioName = "Portfolio";
  let workspaceError: string | null = null;

  try {
    if (requested && ObjectId.isValid(requested)) {
      const owned = await getPortfolioByIdForSessionUser({
        userId: session.userId,
        tenantId: session.tenantId,
        portfolioId: requested
      });
      if (owned?._id) {
        portfolioId = owned._id.toHexString();
        portfolioName = owned.name?.trim() || portfolioName;
      }
    }
    if (!portfolioId) {
      const active = await resolveActiveWorkspacePortfolioId(session);
      if (active && ObjectId.isValid(active)) {
        const owned = await getPortfolioByIdForSessionUser({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioId: active
        });
        if (owned?._id) {
          portfolioId = owned._id.toHexString();
          portfolioName = owned.name?.trim() || portfolioName;
        }
      }
    }
    if (!portfolioId) {
      const provisioned = await provisionDefaultPortfolioForUser({
        userId: session.userId,
        tenantId: session.tenantId,
        watchlistSymbols: ["TSLA"]
      });
      const p = provisioned.portfolio;
      if (p?._id) {
        portfolioId = p._id.toHexString();
        portfolioName = p.name?.trim() || portfolioName;
      }
    }
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[portfolio/alerts] portfolio resolve failed userId=${session.userId} detail=${detail}`
    );
    workspaceError = "Could not load a workspace portfolio. Use Sync from Portfolio or open Portfolio.";
  }

  const portfoliosHubHref =
    portfolioId && !workspaceError
      ? `/portfolios?portfolioId=${encodeURIComponent(portfolioId)}`
      : "/portfolios";

  let alertRows: PortfolioAlertRowVm[] = [];
  let alertAccounts: { id: string; label: string }[] = [];
  let priceRuleRows: PriceRuleRowVm[] = [];
  let nlPriceAlertsEnabled = false;
  let lastActivityIso: string | null = null;
  if (portfolioId && !workspaceError) {
    try {
      const loaded = await adminListPortfolioAlerts(portfolioId);
      const accounts = await listPortfolioAccounts({
        userId: session.userId,
        portfolioId,
        tenantId: session.tenantId
      });
      alertAccounts = accounts
        .filter((ac) => ac._id)
        .map((ac) => ({
          id: ac._id!.toHexString(),
          label: ac.name?.trim() ? ac.name.trim().slice(0, 120) : `Account ${ac._id!.toHexString().slice(0, 8)}…`
        }));
      const typeByAccountId: Record<string, string> = {};
      for (const ac of accounts) {
        if (ac._id) {
          typeByAccountId[ac._id.toHexString()] = ac.type;
        }
      }
      alertRows = loaded.map((a) => ({
        id: a._id!.toHexString(),
        title: a.title,
        body: a.body ?? null,
        severity: a.severity,
        status: a.status,
        symbol: a.symbol ?? null,
        portfolioName: a.portfolioName ?? null,
        accountId: a.accountId?.toHexString() ?? null,
        accountName: a.accountName ?? null,
        accountType: a.accountId ? typeByAccountId[a.accountId.toHexString()] ?? null : null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        metadata: portfolioAlertRowScannerMetadata(a.metadata)
      }));

      const [priceDocs, coreUser] = await Promise.all([
        listActivePortfolioPriceAlertsForUserPortfolio({
          userId: session.userId,
          tenantId: session.tenantId,
          portfolioIdHex: portfolioId
        }),
        ObjectId.isValid(session.userId)
          ? getCoreUserById(new ObjectId(session.userId))
          : Promise.resolve(null)
      ]);
      priceRuleRows = priceDocs.map(mapPriceAlertDocToVm);
      nlPriceAlertsEnabled = canManageNlPriceAlerts(coreUser?.subscriptionPlan, session.roles);

      const activityTimes: number[] = [];
      for (const row of alertRows) {
        activityTimes.push(new Date(row.updatedAt).getTime());
      }
      for (const doc of priceDocs) {
        activityTimes.push(doc.updatedAt.getTime());
      }
      lastActivityIso =
        activityTimes.length > 0 ? new Date(Math.max(...activityTimes)).toISOString() : null;
    } catch (error) {
      const detail = caughtErrorMessage(error);
      console.error(`[portfolio/alerts] list failed portfolioId=${portfolioId} detail=${detail}`);
      workspaceError = "Could not load alerts for this portfolio.";
    }
  }

  const [workspaceRailProps, workspaceTenant] = await Promise.all([
    getWorkspaceProductSidebarPropsForSession(session, "Alerts"),
    getWorkspaceTenantHeaderContext(session.tenantId)
  ]);

  return (
    <PortfolioWorkspaceProductShell
      bodyStyle={{ padding: 0 }}
      feedbackPageLabel="Alerts"
      session={session}
      workspaceRailProps={workspaceRailProps}
      workspaceTenant={workspaceTenant}
    >
      {workspaceError || !portfolioId ? (
            <div
              className="hero-card xf-noise-overlay"
              style={{ maxWidth: "640px", margin: "1rem auto", padding: "1rem" }}
            >
              <p className="eyebrow">Alerts</p>
              <h1 className="hero-title" style={{ fontSize: "1.25rem" }}>
                Workspace unavailable
              </h1>
              {workspaceError ? (
                <p className="status-text status-error" style={{ marginTop: "0.75rem" }}>
                  {workspaceError}
                </p>
              ) : (
                <p className="status-text status-warn" style={{ marginTop: "0.75rem" }}>
                  No portfolio is linked yet. Use Sync or open Portfolio.
                </p>
              )}
              <SyncDefaultPortfolioButton />
              <div className="cta-row" style={{ marginTop: "1rem" }}>
                <Link className="cta cta-secondary" href="/portfolio">
                  <FolderPortfolioIcon className="crud-icon" />
                  Open Portfolio
                </Link>
                <Link className="cta cta-secondary" href="/portfolios">
                  <HomeIcon className="crud-icon" />
                  Home
                </Link>
              </div>
            </div>
          ) : (
            <section className="portfolio-alerts-console surface-card xf-widget section-card">
              <header className="portfolio-alerts-console__head">
                <div className="portfolio-alerts-console__toolbar">
                  <Link className="portfolio-alerts-console__back" href={portfoliosHubHref}>
                    <FolderPortfolioIcon className="crud-icon" aria-hidden />
                    Portfolios
                  </Link>
                </div>
                <h1 className="portfolio-alerts-console__title">Portfolio alerts</h1>
                <p className="portfolio-alerts-console__meta">
                  Book: <strong>{portfolioName}</strong>
                </p>
                <p className="portfolio-alerts-console__hint status-text">
                  Live price movements, options scanner signals, and risk <strong>alerts</strong> for this book. These flag{" "}
                  <strong>actionable</strong> rolls, closes, and income risks in{" "}
                  <span className="portfolio-alerts-realtime-text">real time</span>.
                </p>
              </header>
              <PortfolioAlertsInteractive
                portfolioId={portfolioId}
                portfolioName={portfolioName}
                rows={alertRows}
                priceRules={priceRuleRows}
                alertAccounts={alertAccounts}
                nlPriceAlertsEnabled={nlPriceAlertsEnabled}
                lastActivityIso={lastActivityIso}
              />
            </section>
          )}
    </PortfolioWorkspaceProductShell>
  );
}
