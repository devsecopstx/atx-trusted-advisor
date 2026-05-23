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
  /**
   * Use workspace-product rail grid (full-height rail + main scroll region) even when `rail` is the built-in public
   * resources aside — e.g. `/resources/guides` viewport lock with `mainFooter`.
   */
  workspaceProductGrid?: boolean;
  /** Legal / shared footer under main column only (workspace-product layout). */
  mainFooter?: ReactNode;
  /** Passed through to `AppUserCollapsibleRailLayout` when using workspace-product chrome. */
  workspaceProductShellClassName?: string;
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
  railChrome,
  workspaceProductGrid = false,
  mainFooter,
  workspaceProductShellClassName
}: XchatGuestReadonlyShellProps) {
  const defaultRail = (
    <aside aria-label="Public read-only navigation" className="app-user-public-rail xf-widget">
      <AppUserResourcesRailSection isGlobalAdmin={false} railDisclosureDefaultOpen={false} />
    </aside>
  );

  const resolvedRail = rail ?? defaultRail;
  const resolvedChrome: AppUserRailChromeMode =
    rail != null ? (railChrome ?? "workspace-product") : workspaceProductGrid ? "workspace-product" : "default";

  const mainClassName =
    mainFooter != null && resolvedChrome === "workspace-product"
      ? "app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain"
      : "app-user-shell-with-rail--padded";

  return (
    <AppUserCollapsibleRailLayout
      allowCollapse={false}
      mainClassName={mainClassName}
      mainFooter={mainFooter}
      rail={resolvedRail}
      railChrome={resolvedChrome}
      workspaceProductShellClassName={workspaceProductShellClassName}
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
