import type { ReactNode } from "react";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { MarketVeilBackground } from "@/components/animations/MarketVeilBackground";
import type { SessionUser } from "@/lib/auth";
import type { WorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

export type XoptionsWorkspaceProductShellProps = {
  session: SessionUser;
  workspaceTenant: WorkspaceTenantHeaderContext | null;
  feedbackPageLabel: string;
  children: ReactNode;
};

/** Signed-in `/xoptions*` workspace chrome — sticky approved header, full-height rail, scrollable main + footer column. */
export async function XoptionsWorkspaceProductShell({
  session,
  workspaceTenant,
  feedbackPageLabel,
  children
}: XoptionsWorkspaceProductShellProps) {
  const rail = await AppUserAccountPublicRailForSession({ session, railVariant: "workspace-product" });
  const ambientVeil = workspaceTenant?.ambientMarketVeilEnabled ?? true;

  // When the veil renders, drop the opaque `--xf-xoptions-surface` background
  // so the skyline + canvas show through; otherwise keep the legacy purple-slate
  // surface for tenants that opted out of the veil.
  const shellSurfaceClass = ambientVeil ? "" : "bg-[color:var(--xf-xoptions-surface)]";

  return (
    <div
      className={`xchat-shell flex min-h-0 flex-col overflow-hidden text-[color:var(--xf-text-100)] ${shellSurfaceClass}`.trim()}
    >
      {ambientVeil ? <MarketVeilBackground /> : null}
      <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
        <div className="workspace-product-approved-header-slot">
          <AppUserApprovedHeader
            current="xoptions"
            feedbackPageLabel={feedbackPageLabel}
            session={session}
            workspaceTenant={workspaceTenant}
          />
        </div>
      </div>

      <div className="xchat-body flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 min-w-0 md:px-8 md:py-6">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain min-w-0 w-full max-w-full"
          mainFooter={<GlobalFooter />}
          rail={rail}
          railChrome="workspace-product"
          workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
        >
          {children}
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
