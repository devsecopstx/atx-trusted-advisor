"use client";

import type { ReactNode } from "react";

import {
    AppUserCollapsibleRailLayout,
    type AppUserRailChromeMode
} from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserResourcesRailSection } from "@/app/ui/app-user-rail-nav";
import { XchatGuestPanel } from "@/app/xchat/ui/xchat-guest-panel";
import type { AccessRequestPlanValue } from "@/lib/access-request-plans";

type XchatGuestReadonlyShellProps = {
  children: ReactNode;
  googleLoginHref?: string | null;
  showAccessPanel?: boolean;
  registerDefaultPlan?: AccessRequestPlanValue;
  openRegisterByDefault?: boolean;
  /**
   * Trial/deep-link UX: emphasize OAuth + email registration; tuck returning-user sign-in behind one link.
   */
  registrationFirst?: boolean;
  xOAuthLoginHref?: string;
  emailPasswordLoginHref?: string;
  hideComposerPreview?: boolean;
  /**
   * Replaces the default public resources rail (e.g. signed-in pending approval with
   * `AppUserAccountPublicRailForSession` + `railVariant="workspace-product"` from a server page).
   */
  rail?: ReactNode;
  /** When `rail` is provided, defaults to `workspace-product` chrome. */
  railChrome?: AppUserRailChromeMode;
};

export function XchatGuestReadonlyShell({
  children,
  googleLoginHref = null,
  showAccessPanel = true,
  registerDefaultPlan = "basic",
  openRegisterByDefault = false,
  registrationFirst = false,
  xOAuthLoginHref,
  emailPasswordLoginHref,
  hideComposerPreview = false,
  rail,
  railChrome
}: XchatGuestReadonlyShellProps) {
  const defaultRail = (
    <aside aria-label="Public read-only navigation" className="app-user-public-rail xf-widget">
      <AppUserResourcesRailSection
        isGlobalAdmin={false}
        railDisclosureDefaultOpen={false}
        showReferenceDocs={false}
      />
    </aside>
  );

  const resolvedRail = rail ?? defaultRail;
  const resolvedChrome: AppUserRailChromeMode =
    rail != null ? (railChrome ?? "workspace-product") : "default";

  return (
    <AppUserCollapsibleRailLayout
      allowCollapse={false}
      mainClassName="app-user-shell-with-rail--padded"
      rail={resolvedRail}
      railChrome={resolvedChrome}
    >
      {showAccessPanel ? (
        <XchatGuestPanel
          content={children}
          emailPasswordLoginHref={emailPasswordLoginHref}
          googleLoginHref={googleLoginHref}
          hideComposerPreview={hideComposerPreview}
          openRegisterByDefault={openRegisterByDefault}
          registerDefaultPlan={registerDefaultPlan}
          registrationFirst={registrationFirst}
          xOAuthLoginHref={xOAuthLoginHref}
        />
      ) : (
        children
      )}
    </AppUserCollapsibleRailLayout>
  );
}
