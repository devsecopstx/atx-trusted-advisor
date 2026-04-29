import type { Metadata } from "next";
import Link from "next/link";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import { getSessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { canUserLogin } from "@/modules/identity/authorization";
import { ExpandableResourceScreenshot } from "../2026-options-income-playbook/expandable-screenshot";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Multi-Portfolio Management for HNWI: xAI Outlooks | Resources",
  description:
    "Manage multiple books, accounts, and investment outlooks in one secure workspace. xAI-guided reviews, IBKR-linked snapshots where available, and Mongo-backed portfolio data in aTx Advisor.",
  keywords: ["multi portfolio management", "HNWI portfolio tools", "options portfolio software"],
  alternates: {
    canonical: "/resources/multi-portfolio-management-hnwi",
  },
  openGraph: {
    title: "Multi-Portfolio Management for HNWI: xAI Outlooks | Resources",
    description:
      "Manage multiple books, accounts, and investment outlooks in one secure workspace. xAI-guided reviews, IBKR-linked snapshots where available, and Mongo-backed portfolio data in aTx Advisor.",
    type: "article",
  },
};

const SURFACE_ROWS: { surface: string; hnwiAngle: string }[] = [
  {
    surface: "Portfolio desk",
    hnwiAngle: "Choose which book xChat, watchlist, and desk flows scope to — avoids cross-talk between sleeves.",
  },
  {
    surface: "Broker CSV import",
    hnwiAngle: "Bring custodian exports into the same tenant DB your team already audits — fewer shadow spreadsheets.",
  },
  {
    surface: "Linked snapshots (e.g. IBKR)",
    hnwiAngle: "When integration is enabled, optional read-side context complements manual positions — still reconcile to source.",
  },
];

export default async function ResourcesMultiPortfolioManagementHnwiPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Multi-portfolio HNWI",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article
        className="resources-doc-shell"
        aria-label="Multi-portfolio management for high-net-worth individuals"
      >
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Workspace · HNWI</p>
          <h1 className="resources-doc-hero__title">
            Multi-Portfolio Management for High-Net-Worth Individuals: xAI-Driven Outlooks and Custom Database
            Integrations
          </h1>
          <p className="resources-doc-hero__copy">
            High-net-worth workflows rarely live in a single account. aTx Advisor is built around a{" "}
            <strong>tenant-scoped, Mongo-backed book of record</strong> for positions and watchlists — with a clear{" "}
            <strong>active portfolio workspace</strong> so Grok-backed prompts and desk tools reference the sleeve you
            intend, not a blended accidental default.
          </p>
        </header>

        <section className="resources-doc-section" id="intro">
          <h2>One login, multiple books — disciplined scope</h2>
          <p className="resources-doc-section__desc">
            Multiple portfolios under one user let you separate thesis (e.g. core vs. tactical options sleeve) while
            keeping a unified identity and audit trail inside your tenant. Switching the workspace updates how xChat
            preloads context and how imports attach — reducing “wrong book” errors that plague informal spreadsheets.
          </p>
          <p className="resources-doc-footnote">
            Educational article; product capabilities vary by tenant configuration and entitlements.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="surfaces">
          <h2>Where multi-book shows up</h2>
          <table className="resources-doc-table" aria-label="HNWI multi-portfolio surfaces">
            <thead>
              <tr>
                <th>Surface</th>
                <th>HNWI angle</th>
              </tr>
            </thead>
            <tbody>
              {SURFACE_ROWS.map((row) => (
                <tr key={row.surface}>
                  <td>{row.surface}</td>
                  <td>{row.hnwiAngle}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="resources-doc-section__desc mt-3">
            IBKR-linked snapshots appear when that path is configured for your deployment — they do not replace custodial
            statements; use them as an additional lens alongside your compliance stack.
          </p>
        </section>

        <section className="resources-doc-section" id="xai">
          <h2>xAI-driven outlooks (guardrails)</h2>
          <p className="resources-doc-section__desc">
            xChat surfaces scenario discussion and structured comparisons against your{" "}
            <strong>scoped portfolio</strong>. Effective models follow <strong>persona defaults</strong> and published
            tool/RAG scope — appropriate for exploring outlooks and trade-offs, not for outsourcing fiduciary duty.
            Recommendations remain yours; Grok accelerates iteration across scenarios when prompts stay anchored to the
            active book.
          </p>
          <p className="resources-doc-section__desc">
            Read <Link href="/resources/secret-sauce">Secret sauce</Link> for personas, collections, and governance.
          </p>
        </section>

        <section className="resources-doc-section" id="data-layer">
          <h2>Production-grade data in one workspace</h2>
          <p className="resources-doc-section__desc">
            Portfolio accounts, positions, and watchlist rows persist in the application database under your tenant —
            the foundation for consistent reporting, alerts, and chat preload. Broker CSV import brings custodian
            activity into that same store so operators aren’t reconciling three silos. That’s the practical meaning of
            “integration” here: <strong>one coherent datastore per tenant</strong> with role-gated access — not ad-hoc
            files per analyst.
          </p>
          <ExpandableResourceScreenshot src="/landing/portfolio.png" alt="Portfolio desk (illustrative)">
            <p className="resources-doc-footnote resources-doc-footnote--full">
              UI evolves; sign in to see your portfolios. Flow:{" "}
              <Link href="/resources/decision-workflow">Decision workflow</Link>.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="security">
          <h2>Security and posture</h2>
          <ul className="resources-doc-list">
            <li>
              <strong>Tenant isolation.</strong> Data is partitioned by tenant; session routes enforce access with your
              platform roles.
            </li>
            <li>
              <strong>No shadow IT requirement.</strong> Centralizing books reduces duplicate manual ledgers — still match
              to custodian of record.
            </li>
            <li>
              <strong>Options tooling.</strong> xOptions and desk flows respect the same workspace scope when enabled — see{" "}
              <Link href="/resources/leap-options-playbook">LEAP playbook</Link> and{" "}
              <Link href="/resources/cash-secured-puts-mastery">CSP mastery</Link>.
            </li>
          </ul>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Align xChat with your active book →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Technology descriptions are illustrative. Broker integrations and features depend on configuration,
            approvals, and applicable agreements.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader
          current="xchat"
          feedbackPageLabel="Resources · Multi-portfolio HNWI"
          session={session}
        />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body" style={{ padding: "1rem" }}>
        {approved && session ? (
          <AppUserCollapsibleRailLayout rail={workspaceProductRail} railChrome="workspace-product">
            {shellContent}
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref} rail={workspaceProductRail ?? undefined}>
            {shellContent}
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
