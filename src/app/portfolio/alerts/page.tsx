import { ObjectId } from "mongodb";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FolderPortfolioIcon, HomeIcon } from "@/app/admin/ui/crud-icons";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { resolveActiveWorkspacePortfolioId } from "@/lib/app-user-default-book";
import { getSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import {
    adminListPortfolioAlerts,
    getPortfolioByIdForSessionUser,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { canUserLogin } from "@/modules/identity/authorization";

import { SyncDefaultPortfolioButton } from "@/app/portfolio/ui/sync-default-portfolio-button";

function severityClass(sev: string): string {
  if (sev === "critical") return "portfolio-alerts-row--critical";
  if (sev === "warning") return "portfolio-alerts-row--warn";
  return "portfolio-alerts-row--info";
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

  let alerts: Awaited<ReturnType<typeof adminListPortfolioAlerts>> = [];
  if (portfolioId && !workspaceError) {
    try {
      alerts = await adminListPortfolioAlerts(portfolioId);
    } catch (error) {
      const detail = caughtErrorMessage(error);
      console.error(`[portfolio/alerts] list failed portfolioId=${portfolioId} detail=${detail}`);
      workspaceError = "Could not load alerts for this portfolio.";
    }
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Alerts" session={session} />

      <div className="xchat-body portfolio-page-body" style={{ padding: 0 }}>
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<AppUserAccountPublicRailForSession session={session} />}
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
                <Link className="cta cta-secondary" href="/">
                  <HomeIcon className="crud-icon" />
                  Home
                </Link>
              </div>
            </div>
          ) : (
            <section className="portfolio-alerts-console surface-card xf-widget section-card">
              <header className="portfolio-alerts-console__head">
                <h1 className="portfolio-alerts-console__title">Portfolio alerts</h1>
                <p className="portfolio-alerts-console__meta">
                  Book: <strong>{portfolioName}</strong>
                </p>
                <p className="portfolio-alerts-console__hint status-text">
                  Price and desk alerts for this portfolio. Admins can create and route alerts from Admin Hub →
                  portfolio tools.
                </p>
              </header>
              {alerts.length === 0 ? (
                <p className="status-text portfolio-alerts-console__empty">No alerts for this portfolio yet.</p>
              ) : (
                <ul className="portfolio-alerts-list">
                  {alerts.map((a) => (
                    <li
                      key={a._id!.toHexString()}
                      className={`portfolio-alerts-row xf-noise-overlay ${severityClass(a.severity)}`}
                    >
                      <div className="portfolio-alerts-row__top">
                        <span className="portfolio-alerts-row__title">{a.title}</span>
                        <span className="portfolio-alerts-row__badges">
                          <span className="portfolio-alerts-badge">{a.severity}</span>
                          <span className="portfolio-alerts-badge portfolio-alerts-badge--muted">{a.status}</span>
                          {a.symbol ? (
                            <span className="portfolio-alerts-badge portfolio-alerts-badge--sym">{a.symbol}</span>
                          ) : null}
                        </span>
                      </div>
                      {a.body ? <p className="portfolio-alerts-row__body">{a.body}</p> : null}
                      <p className="portfolio-alerts-row__time">
                        Updated {a.updatedAt.toLocaleString()} · Created {a.createdAt.toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
