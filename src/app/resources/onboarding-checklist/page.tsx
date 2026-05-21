import type { Metadata } from "next";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import { getSessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { canUserLogin } from "@/modules/identity/authorization";

import { OnboardingChecklistClient } from "./onboarding-checklist-client";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";
import "./onboarding-checklist.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Institutional Onboarding | Resources",
  description:
    "HNWI and family-office onboarding: capital architecture, conviction watchlist, risk posture, IBKR parity, xAI advisory, validation, and audit-logged institutional workspace activation.",
  alternates: {
    canonical: "/resources/onboarding-checklist",
  },
  openGraph: {
    title: "Institutional Onboarding | Resources",
    description:
      "Seven foundations from lot-level portfolio integrity to xAI-orchestrated options overlays — white-glove onboarding for sophisticated capital stewards.",
    type: "article",
  },
};

export default async function ResourcesOnboardingChecklistPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Institutional Onboarding",
        railVariant: "workspace-product",
      })
    : null;

  const article = <OnboardingChecklistClient userId={session?.userId ?? null} />;

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader
          current="xchat"
          feedbackPageLabel="Resources · Institutional Onboarding"
          session={session}
        />
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
