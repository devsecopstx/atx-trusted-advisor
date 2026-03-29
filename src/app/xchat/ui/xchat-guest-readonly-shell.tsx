"use client";

import type { ReactNode } from "react";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserAccountRailSection, AppUserResourcesRailSection } from "@/app/ui/app-user-rail-nav";

type XchatGuestReadonlyShellProps = {
  children: ReactNode;
};

export function XchatGuestReadonlyShell({ children }: XchatGuestReadonlyShellProps) {
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
      {children}
    </AppUserCollapsibleRailLayout>
  );
}
