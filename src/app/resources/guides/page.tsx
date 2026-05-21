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
import { RESOURCE_GUIDE_SECTIONS } from "@/lib/marketing/resource-guides-catalog";
import { canUserLogin } from "@/modules/identity/authorization";

import "@/app/portfolios/portfolios-dashboard.css";
import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";
import { ResourceGuidesHubPanels } from "./resource-guides-hub-panels";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Guides | Educational Hub",
  description:
    "Browse structured guides on xFinance workspaces, xChat prompts, wheel & xOptions foundations, and options income playbooks. All content connects directly to the free Educational Hub at /resources.",
  alternates: {
    canonical: "/resources/guides"
  },
  openGraph: {
    title: "Guides | Educational Hub — xChat, xOptions & Wheel Workflows",
    description:
      "Practical guides for xFinance users: xChat prompts, wheel strategies, xOptions foundations, and risk workflows. Start from the main Educational Hub.",
    type: "website"
  }
};

export default async function ResourcesGuidesHubPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Guides",
        railVariant: "workspace-product"
      })
    : null;

  const article = (
    <article className="resources-doc-shell" aria-label="Resources guides">
      <div className="mb-6 text-sm">
        <Link href="/resources" className="text-[var(--xf-gain-green)] hover:underline">
          ← Back to Educational Hub
        </Link>
      </div>

      <header className="resources-doc-hero">
        <p className="resources-doc-hero__eyebrow">Resources · Guides</p>
        <h1 className="resources-doc-hero__title">Guides</h1>
        <p className="resources-doc-hero__copy resources-doc-hero__copy--full">
          Choose a panel — platform overview for Austin HNWI desks (
          <strong className="resources-guides-hub__hero-strong">xFinance</strong> workspace, premium stack, onboarding),
          <strong className="resources-guides-hub__hero-strong"> xChat</strong> prompts, wheel income foundations tied to{" "}
          <strong className="resources-guides-hub__hero-strong">xOptions</strong>, then deeper playbooks. Everything here
          is educational; it is not individualized advice.
        </p>
      </header>

      <nav className="resources-doc-nav resources-guides-hub__jump" aria-label="Guide categories">
        {RESOURCE_GUIDE_SECTIONS.map((section) => (
          <a key={section.id} className="resources-doc-nav__chip" href={`#${section.id}`}>
            {section.shortLabel}
          </a>
        ))}
      </nav>

      <ResourceGuidesHubPanels sections={RESOURCE_GUIDE_SECTIONS} />

      <p className="resources-guides-hub__note">
        <span className="resources-about-pillars-legal-note">Not financial advice.</span>{" "}
        {`Articles describe product workflows and general options education only.`}
      </p>
    </article>
  );

  return (
    <div className="xchat-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-transparent">
      {approved && session ? (
        <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[color-mix(in_srgb,var(--xf-bg-800)_82%,transparent)] backdrop-blur-md">
          <div className="workspace-product-approved-header-slot">
            <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Guides" session={session} />
          </div>
        </div>
      ) : (
        <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[color-mix(in_srgb,var(--xf-bg-800)_82%,transparent)] backdrop-blur-md">
          <XchatGuestHeader />
        </div>
      )}

      <div className="portfolio-page-body xchat-body flex min-h-0 flex-1 flex-col overflow-hidden">
        {approved && session ? (
          <AppUserCollapsibleRailLayout
            mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain"
            mainFooter={<GlobalFooter />}
            rail={workspaceProductRail}
            railChrome="workspace-product"
            workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
          >
            {article}
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell
            googleLoginHref={googleLoginHref}
            mainFooter={<GlobalFooter />}
            rail={workspaceProductRail ?? undefined}
            workspaceProductGrid
            workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
          >
            {article}
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
