import type { CSSProperties, ReactNode } from "react";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import type { AppUserProductNavCurrent } from "@/app/ui/app_user-product-nav";
import { WorkspaceProductLegalFooter } from "@/app/ui/workspace-product-legal-footer";
import { WorkspaceProductSidebar } from "@/app/ui/workspace-product-sidebar";
import type { SessionUser } from "@/lib/auth";
import type { WorkspaceProductSidebarServerProps } from "@/lib/workspace-product-sidebar-server-props";
import type { WorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

export type PortfolioWorkspaceProductShellProps = {
  session: SessionUser;
  workspaceTenant: WorkspaceTenantHeaderContext | null;
  feedbackPageLabel: string;
  workspaceRailProps: WorkspaceProductSidebarServerProps;
  children: ReactNode;
  /** Row(s) below approved header inside the sticky stack (e.g. `/portfolios` desk metrics). */
  headerAddon?: ReactNode;
  /** Extra classes on the scroll-body wrapper (`portfolio-page-body xchat-body`). */
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
  /** Extra classes on the main column scrollport inside the rail layout. */
  mainClassName?: string;
  /** Approved header nav highlight (defaults to portfolio). */
  current?: AppUserProductNavCurrent;
};

/**
 * `/portfolio*` workspace chrome — matches `/portfolios` viewport lock: sticky approved header, rail + scrollable main,
 * legal footer only under the main column (rail spans full height).
 */
export function PortfolioWorkspaceProductShell({
  session,
  workspaceTenant,
  feedbackPageLabel,
  workspaceRailProps,
  children,
  headerAddon = null,
  bodyClassName,
  bodyStyle,
  mainClassName,
  current = "portfolio"
}: PortfolioWorkspaceProductShellProps) {
  const bodyClasses = [
    "portfolio-page-body",
    "xchat-body",
    "flex",
    "min-h-0",
    "flex-1",
    "flex-col",
    "overflow-hidden",
    bodyClassName?.trim()
  ]
    .filter(Boolean)
    .join(" ");

  const mainScrollClassName = [
    "app-user-shell-with-rail--padded",
    "min-h-0",
    "flex-1",
    "overflow-y-auto",
    "overscroll-contain",
    mainClassName?.trim()
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="xchat-shell flex min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[color-mix(in_srgb,var(--xf-bg-800)_82%,transparent)] backdrop-blur-md">
        <div className="workspace-product-approved-header-slot">
          <AppUserApprovedHeader
            current={current}
            feedbackPageLabel={feedbackPageLabel}
            session={session}
            workspaceTenant={workspaceTenant}
          />
        </div>
        {headerAddon}
      </div>

      <div className={bodyClasses} style={bodyStyle}>
        <AppUserCollapsibleRailLayout
          mainClassName={mainScrollClassName}
          mainFooter={<WorkspaceProductLegalFooter />}
          rail={<WorkspaceProductSidebar {...workspaceRailProps} />}
          railChrome="workspace-product"
          workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
        >
          {children}
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
