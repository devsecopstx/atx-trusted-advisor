import type { Metadata } from "next";

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

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";
import { ResourceGuidesHubPanels } from "./resource-guides-hub-panels";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Guides | Resources",
  description:
    "Browse xFinance workspace topics, xChat prompts, wheel and xOptions foundations, and options playbooks — educational resources in one place.",
  alternates: {
    canonical: "/resources/guides"
  },
  openGraph: {
    title: "Guides | Resources",
    description:
      "Browse xFinance workspace topics, xChat prompts, wheel and xOptions foundations, and options playbooks — educational resources in one place.",
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
      <header className="resources-doc-hero">
        <p className="resources-doc-hero__eyebrow">Resources · Guides</p>
        <h1 className="resources-doc-hero__title">Guides</h1>
        <p className="resources-doc-hero__copy resources-doc-hero__copy--full">
          Choose a panel — platform and <strong className="resources-guides-hub__hero-strong">xFinance</strong> workspace,
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
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Guides" session={session} />
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
