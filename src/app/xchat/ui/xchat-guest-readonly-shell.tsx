"use client";

import type { ReactNode } from "react";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserAccountRailSection, AppUserResourcesRailSection } from "@/app/ui/app-user-rail-nav";
import { XchatGuestPanel } from "@/app/xchat/ui/xchat-guest-panel";
import type { AccessRequestPlanValue } from "@/lib/access-request-plans";

type XchatGuestReadonlyShellProps = {
  children: ReactNode;
  googleLoginHref?: string | null;
  showAccessPanel?: boolean;
  registerDefaultPlan?: AccessRequestPlanValue;
  openRegisterByDefault?: boolean;
};

export function XchatGuestReadonlyShell({
  children,
  googleLoginHref = null,
  showAccessPanel = true,
  registerDefaultPlan = "basic",
  openRegisterByDefault = false
}: XchatGuestReadonlyShellProps) {
  return (
    <AppUserCollapsibleRailLayout
      allowCollapse={false}
      mainClassName="app-user-shell-with-rail--padded"
      rail={
        <aside aria-label="Public read-only navigation" className="app-user-public-rail xf-widget">
          <AppUserResourcesRailSection
            isGlobalAdmin={false}
            railDisclosureDefaultOpen
            showReferenceDocs={false}
          />
          <AppUserAccountRailSection
            isGlobalAdmin={false}
            railDisclosureDefaultOpen
            showSettingsLink={false}
          />
        </aside>
      }
    >
      {showAccessPanel ? (
        <XchatGuestPanel
          content={children}
          googleLoginHref={googleLoginHref}
          registerDefaultPlan={registerDefaultPlan}
          openRegisterByDefault={openRegisterByDefault}
        />
      ) : (
        children
      )}
    </AppUserCollapsibleRailLayout>
  );
}
