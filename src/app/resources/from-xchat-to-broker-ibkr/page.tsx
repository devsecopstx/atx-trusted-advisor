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
  title: "From xChat to Broker Execution (IBKR) | Resources",
  description:
    "Go from natural-language prompt in xChat to audited, broker-ready orders in minutes. Full end-to-end workflow with audit logs and paper-trading path.",
  keywords: [
    "options trading automation",
    "xChat options",
    "IBKR options integration",
    "xOptions workflow",
  ],
  alternates: {
    canonical: "/resources/from-xchat-to-broker-ibkr",
  },
  openGraph: {
    title: "From xChat to Broker Execution (IBKR) | Resources",
    description:
      "Go from natural-language prompt in xChat to audited, broker-ready orders in minutes. Full end-to-end workflow with audit logs and paper-trading path.",
    type: "article",
  },
};

const PIPELINE_ROWS: { stage: string; what: string }[] = [
  {
    stage: "xChat",
    what: "Natural-language intent, persona guardrails, workspace-scoped portfolio/watchlist context via tools.",
  },
  {
    stage: "Structure",
    what: "xOptions strategy builder and (where deployed) strategy-job orchestration for repeatable legs and artifacts.",
  },
  {
    stage: "Custodian",
    what: "IBKR Client Portal session — read snapshots of positions, orders, and executions with masked audit logs.",
  },
  {
    stage: "Paper first",
    what: "Operator-style validation against paper gateway sessions before treating any path as production-ready.",
  },
];

export default async function ResourcesFromXchatToBrokerIbkrPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · xChat → IBKR",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="From xChat to broker execution with IBKR">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Execution · IBKR</p>
          <h1 className="resources-doc-hero__title">
            From xChat Idea to Broker Execution: Automating Options Workflows with aTx Trusted Advisory + IBKR
          </h1>
          <p className="resources-doc-hero__copy">
            <strong>aTx Trusted Advisory</strong> ships the <strong>aTx Advisor</strong> workspace: Grok-backed xChat for
            ideas, xOptions for stepped structures, and an optional <strong>Interactive Brokers</strong> Client Portal
            link for read-side validation — tied together with correlation-ID audit trails so support and compliance can
            follow what happened.
          </p>
        </header>

        <section className="resources-doc-section" id="today-vs-roadmap">
          <h2>What ships today vs. what you are wiring toward</h2>
          <p className="resources-doc-section__desc">
            IBKR integration in this codebase emphasizes <strong>consent</strong>,{" "}
            <strong>sealed session handling</strong>, and <strong>read paths</strong> (accounts, bundled snapshots:
            summary, positions, orders, executions) with{" "}
            <strong>[ibkr/audit]</strong> structured logs — pairing operator actions to{" "}
            <code className="font-mono text-[var(--xf-text-300)]">correlationId</code> values. Automated{" "}
            <strong>live order placement straight from a chat bubble</strong> is a roadmap-dependent capability: treat
            broker-ready tickets as the outcome of your review loop until your tenant explicitly enables downstream
            execution features.
          </p>
          <p className="resources-doc-footnote">
            Educational article; capabilities vary by environment. <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="pipeline">
          <h2>End-to-end mental model</h2>
          <table className="resources-doc-table" aria-label="xChat to broker workflow stages">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE_ROWS.map((row) => (
                <tr key={row.stage}>
                  <td>{row.stage}</td>
                  <td>{row.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="resources-doc-section" id="xchat">
          <h2>xChat — ideas with guardrails</h2>
          <p className="resources-doc-section__desc">
            Prompt in plain language; effective models respect persona defaults and tool scope so answers reference{" "}
            <strong>your</strong> book when tools succeed — reducing copy/paste errors on the way to a ticket.
          </p>
          <ExpandableResourceScreenshot src="/landing/xchat.png" alt="xChat workspace (illustrative)">
            <p className="resources-doc-footnote resources-doc-footnote--full">
              UI evolves; model and tool availability depend on tenant configuration.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="xoptions">
          <h2>xOptions — translate intent into legs</h2>
          <p className="resources-doc-section__desc">
            Use the strategy builder when your account has options entitlements. For durable, auditable orchestration at
            scale, deployments may pair this surface with <strong>strategy jobs</strong> / backend flows — see product
            docs for your environment.
          </p>
          <ExpandableResourceScreenshot src="/landing/xoptions.png" alt="xOptions workspace (illustrative)">
            <p className="resources-doc-footnote resources-doc-footnote--full">
              Hardcore strategy jobs may proxy through the JVM worker when <code className="font-mono text-[0.75rem]">ATXFINANCE_BACKEND_ORIGIN</code>{" "}
              is configured — operator concern.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="ibkr">
          <h2>IBKR — link, snapshot, audit</h2>
          <p className="resources-doc-section__desc">
            Signed-in users can open <Link href="/account/integrations/ibkr">Account → Integrations → IBKR</Link> (when the
            integration is enabled) to record consent and attach a Client Portal session material via secure cookies —
            not passwords in Mongo. Snapshot reads validate that positions and recent orders match what you expect before
            you trade elsewhere.
          </p>
          <ul className="resources-doc-list">
            <li>
              <strong>Paper gateway.</strong> Teams typically validate against IBKR paper logins and gateway cookies
              before any live-grade narrative — matching internal runbooks.
            </li>
            <li>
              <strong>Audit pairs.</strong> Responses carry correlation identifiers you can align with{" "}
              <strong>[ibkr/audit]</strong> lines for support escalations.
            </li>
          </ul>
        </section>

        <section className="resources-doc-section" id="audit">
          <h2>Audit logs beyond IBKR</h2>
          <p className="resources-doc-section__desc">
            xChat history persists in-app for eligible sessions; admin and access flows emit audit events elsewhere in the
            platform. The point is one posture: <strong>traceable actions</strong> suitable for professional workflows —
            not anonymous toy trading.
          </p>
        </section>

        <section className="resources-doc-section" id="related">
          <h2>Related</h2>
          <p className="resources-doc-section__desc">
            <Link href="/resources/multi-portfolio-management-hnwi">Multi-portfolio HNWI</Link>,{" "}
            <Link href="/resources/options-risk-management-frameworks">Risk frameworks</Link>,{" "}
            <Link href="/resources/secret-sauce">Secret sauce</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Start in xChat →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve substantial risk. Broker connectivity depends on configuration; you remain responsible for
            suitability and execution decisions.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · xChat → IBKR" session={session} />
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
