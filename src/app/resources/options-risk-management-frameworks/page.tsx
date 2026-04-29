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
  title: "Options Risk Management Frameworks | Resources",
  description:
    "Protect your book with xAI-powered risk guardrails. Three strategy tiers, position sizing rules, and workspace-scoped reviews that surface conflicting exposure and mandate friction before you trade.",
  keywords: ["options risk management", "conservative options strategy", "xAI risk guardrails"],
  alternates: {
    canonical: "/resources/options-risk-management-frameworks",
  },
  openGraph: {
    title: "Options Risk Management Frameworks | Resources",
    description:
      "Protect your book with xAI-powered risk guardrails. Three strategy tiers, position sizing rules, and workspace-scoped reviews that surface conflicting exposure and mandate friction before you trade.",
    type: "article",
  },
};

const TIER_ROWS: { tier: string; posture: string; sizingSketch: string }[] = [
  {
    tier: "Conservative",
    posture: "Wider buffers, smaller % of book per trade, fewer short legs close to the money.",
    sizingSketch: "Caps per symbol and per strategy type; prioritize assignment buffers and cash clarity.",
  },
  {
    tier: "Balanced",
    posture: "Blend yield with retained upside/downsideroom — typical wheel-style and covered overlays.",
    sizingSketch: "Rolling rules before entry; separate sleeves if you run income vs. growth books.",
  },
  {
    tier: "Aggressive",
    posture: "More convexity or tighter strikes — accepts path and gamma complexity.",
    sizingSketch: "Stricter max-loss bands and roll triggers; often pairs with LEAP/diagonal literacy.",
  },
];

export default async function ResourcesOptionsRiskManagementFrameworksPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Options risk frameworks",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="Options risk management frameworks with xAI">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Risk · xAI</p>
          <h1 className="resources-doc-hero__title">
            Options Risk Management Frameworks: Conservative, Balanced &amp; Aggressive Playbooks Powered by xAI
          </h1>
          <p className="resources-doc-hero__copy">
            Risk management is not a single dashboard — it is <strong>policy + sizing + review rhythm</strong>. In aTx Advisor,
            Grok-backed xChat reads your <strong>scoped workspace</strong> (portfolio and watchlist context when
            available) so discussions align with the book you selected, while personas and tool scope provide guardrails
            against generic off-book suggestions.
          </p>
        </header>

        <section className="resources-doc-section" id="intro">
          <h2>What “xAI guardrails” means here</h2>
          <p className="resources-doc-section__desc">
            Guardrails are <strong>compositional</strong>: tenant persona defaults, published RAG where enabled, and
            structured tools that pull <em>your</em> positions and quotes — not a substitute for compliance sign-off.
            They help you compare a proposed leg set against concentration, liquidity, and mandate language before you
            pull the trigger.
          </p>
          <p className="resources-doc-footnote">
            Educational article; not individualized advice.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="tiers">
          <h2>Three playbook tiers (conceptual)</h2>
          <p className="resources-doc-section__desc">
            Labels are coarse — your IPS wins — but teams often anchor narratives this way:
          </p>
          <table className="resources-doc-table" aria-label="Conservative balanced aggressive options risk tiers">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Posture</th>
                <th>Sizing sketch</th>
              </tr>
            </thead>
            <tbody>
              {TIER_ROWS.map((row) => (
                <tr key={row.tier}>
                  <td>{row.tier}</td>
                  <td>{row.posture}</td>
                  <td>{row.sizingSketch}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="resources-doc-section__desc mt-3">
            Deep dives:{" "}
            <Link href="/resources/cash-secured-puts-mastery">CSP mastery</Link>,{" "}
            <Link href="/resources/covered-calls-2026-balanced-income">Covered calls 2026</Link>,{" "}
            <Link href="/resources/leap-options-playbook">LEAP playbook</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="workspace">
          <h2>Workspace awareness &amp; friction detection</h2>
          <p className="resources-doc-section__desc">
            When xChat is scoped to your active portfolio, prompts can reference overlapping symbols, watchlist{" "}
            <strong>risk profile</strong> / outlook fields, and desk-style reminders (earnings proximity, assignment
            pressure) — so you catch <strong>conflicts between intent and book</strong> (e.g. doubling exposure under the
            same thesis) before execution. That is “real-time” in the sense of live conversation against current
            workspace snapshot, not a guarantee of automated order blocking.
          </p>
          <ExpandableResourceScreenshot src="/landing/xchat.png" alt="xChat workspace (illustrative)">
            <p className="resources-doc-footnote resources-doc-footnote--full">
              Product UI evolves; behavior depends on entitlements and persona configuration.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="multi-book">
          <h2>Multi-book discipline</h2>
          <p className="resources-doc-section__desc">
            If you run several portfolios under one login, switch the workspace before risk reviews so Grok does not
            blend sleeves. See{" "}
            <Link href="/resources/multi-portfolio-management-hnwi">Multi-portfolio management (HNWI)</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="more">
          <h2>Further reading</h2>
          <p className="resources-doc-section__desc">
            <Link href="/resources/decision-workflow">Decision workflow</Link>,{" "}
            <Link href="/resources/secret-sauce">Secret sauce</Link>,{" "}
            <Link href="/resources/2026-options-income-playbook">2026 income playbook</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Stress-test sizing in xChat →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve substantial risk of loss. Past hypothetical frameworks do not guarantee future results.
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
          feedbackPageLabel="Resources · Options risk frameworks"
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
