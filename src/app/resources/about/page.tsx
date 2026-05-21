import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import { getSessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";
import { canUserLogin } from "@/modules/identity/authorization";
import type { Metadata } from "next";
import Link from "next/link";

import { XfinancePremiumValueBlock } from "@/app/ui/xfinance-premium-value-block";
import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

import { AboutPillarCards } from "./about-pillar-cards";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About xFinance for Austin HNWI Investors & Advisors | Resources",
  description:
    "What xFinance delivers for Austin high-net-worth retail investors and Investment Advisors — xChat, xOptions, portfolio desk, multi-tenant admin, and illustrative time/value math for options income workflows.",
  alternates: {
    canonical: "/resources/about"
  },
  openGraph: {
    title: "About the Educational Hub | xFinance Resources",
    description:
      "How our options income resources are structured and how they map directly to the xFinance workspace (xChat, xOptions, portfolios, and guardrails).",
    type: "website"
  }
};

export default async function ResourcesAboutPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · About",
        railVariant: "workspace-product"
      })
    : null;
  const article = (
    <article className="resources-doc-shell" aria-label="About the Educational Hub">
      <div className="mb-6 text-sm">
        <Link href="/resources" className="text-[var(--xf-gain-green)] hover:underline">
          ← Back to Educational Hub
        </Link>
      </div>

      <header className="resources-doc-hero">
        <p className="resources-doc-hero__eyebrow">Resources · About</p>
        <h1 className="resources-doc-hero__title">About xFinance for Austin HNWI desks</h1>
        <p className="resources-doc-hero__copy resources-doc-hero__copy--full">
          {`aTx Trusted Advisory built xFinance for Austin high-net-worth retail investors and the Investment Advisors who run their books — options income with book-aware Grok, production xOptions, and audit-ready portfolio workflows in one workspace.`}
        </p>
      </header>

      <section className="resources-doc-section">
        <p className="resources-doc-section__desc">
          {`Whether you manage your own concentrated tech and real-estate wealth or advise families across multiple custodians, the Educational Hub maps directly to xChat prompts, xOptions structures, and portfolio guardrails inside the product.`}
        </p>
        <p className="resources-doc-section__desc resources-doc-section__desc--closing">
          {`Start with the premium stack overview below, then dive into playbooks and onboarding checklists.`}
        </p>
      </section>

      <XfinancePremiumValueBlock variant="doc" />

      <section className="resources-doc-section resources-doc-section--pillars" id="eight-pillars">
        <h2>Eight pillars — options income, risk &amp; execution</h2>
        <p className="resources-doc-section__desc">
          Educational articles on wheels, CSPs, covered calls, LEAP overlays, multi-book workflows, risk tiers, and the
          path from xChat to IBKR-linked snapshots — public reading;{" "}
          <span className="resources-about-pillars-legal-note">not individualized advice.</span>
        </p>
        <nav aria-label="Eight pillars">
          <AboutPillarCards pillars={ADVISORY_RESOURCE_PILLARS} />
        </nav>
      </section>
    </article>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · About" session={session} />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body" style={{ padding: "1rem" }}>
        {approved && session ? (
          <AppUserCollapsibleRailLayout rail={workspaceProductRail} railChrome="workspace-product">
            {article}
            <GlobalFooter />
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref} rail={workspaceProductRail ?? undefined}>
            {article}
            <GlobalFooter />
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
