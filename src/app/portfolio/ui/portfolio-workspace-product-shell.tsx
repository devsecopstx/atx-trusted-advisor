import type { CSSProperties, ReactNode } from "react";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
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
  bodyStyle
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

  return (
    <div className="xchat-shell flex min-h-0 flex-col overflow-hidden bg-[var(--xf-bg-900)]">
      <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
        <div className="workspace-product-approved-header-slot">
          <AppUserApprovedHeader
            current="portfolio"
            feedbackPageLabel={feedbackPageLabel}
            session={session}
            workspaceTenant={workspaceTenant}
          />
        </div>
        {headerAddon}
      </div>

      <div className={bodyClasses} style={bodyStyle}>
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain"
          mainFooter={<GlobalFooter />}
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
