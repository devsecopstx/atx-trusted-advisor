"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import type { SessionUser } from "@/lib/auth";
import type { WorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import type { AppUserProductNavCurrent } from "./app_user-product-nav";
import {
    LucideBookOpenIcon,
    LucideClipboardListIcon,
    LucideSettingsIcon,
    LucideUploadIcon
} from "./lucide-product-icons";
import { resolveTenantDeskDisplayLabel } from "@/lib/tenant-desk-display-label";

import { USER_PRODUCT_HOME_ARIA_LABEL } from "./product-brand-constants";
import { useTenantShellBranding } from "./tenant-branding-context";
import { isPathAllowedByTenantUxRoutes } from "./tenant-ux-nav-visibility";
import { useTenantUxNavVisibility } from "./use-tenant-ux-nav-visibility";
import { WorkspaceRailAppearance } from "./workspace-rail-appearance";
import { XchatHeaderBrand } from "./xchat-header-brand";
import { XfHoverHint } from "./xf-hover-hint";

type AppUserApprovedHeaderProps = {
  session: SessionUser;
  current: AppUserProductNavCurrent;
  /** Kept for call-site compatibility; account feedback uses the sidebar or pathname. */
  feedbackPageLabel?: string;
  /**
   * When set (e.g. from `getWorkspaceTenantHeaderContext`), show the same tenant display name as `/portfolios`.
   */
  workspaceTenant?: WorkspaceTenantHeaderContext | null;
  /** Optional trailing chrome (e.g. Hub session panel) rendered after appearance controls. */
  trailingExtras?: ReactNode;
};

export function AppUserApprovedHeader(props: AppUserApprovedHeaderProps) {
  void props.current;
  void props.feedbackPageLabel;

  const branding = useTenantShellBranding();
  const { allowedRoutes, defaultLanding, isPathVisible, isAccountTasksVisible } =
    useTenantUxNavVisibility();

  const brandHref = useMemo(() => {
    if (!allowedRoutes) {
      return "/xchat";
    }
    if (isPathAllowedByTenantUxRoutes("/xchat", allowedRoutes)) {
      return "/xchat";
    }
    return defaultLanding.startsWith("/") ? defaultLanding : "/xchat";
  }, [allowedRoutes, defaultLanding]);

  const tenantDesk = resolveTenantDeskDisplayLabel(branding, props.workspaceTenant?.name);
  const showTenantCard = Boolean(tenantDesk?.tagline);
  const showResourcesNav = isPathVisible("/resources");
  const showBrokerImportNav = isPathVisible("/import-activity");
  const showTasksNav = isAccountTasksVisible();
  const showAdminHubNav = isGlobalAdmin(props.session.roles);
  const showWorkspaceQuickNav =
    showResourcesNav || showBrokerImportNav || showTasksNav || showAdminHubNav;

  return (
    <header className="xchat-header xchat-header--tenant-workspace">
      <div className="xchat-header-brand-stack">
        <Link
          aria-label={tenantDesk?.primary ? `${tenantDesk.primary} — workspace` : USER_PRODUCT_HOME_ARIA_LABEL}
          className="xchat-header-brand"
          href={brandHref}
        >
          {tenantDesk?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URLs + arbitrary tenant CDNs
            <img
              alt=""
              className="xchat-header-tenant-logo xchat-header-tenant-logo--header-compact"
              height={28}
              src={tenantDesk.logoUrl}
              width={28}
            />
          ) : tenantDesk ? (
            <span aria-hidden className="xchat-header-tenant-initials">
              {tenantDesk.primary.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <XchatHeaderBrand compact />
          )}
        </Link>
        {tenantDesk ? (
          <div className="xchat-header-tenant-under-brand">
            <span className="xchat-header-tenant-under-brand__name">{tenantDesk.primary}</span>
            {tenantDesk.tagline ? (
              <span className="xchat-header-tenant-under-brand__tagline">{tenantDesk.tagline}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="xchat-header-main">
        <div className="xchat-header-trailing xchat-header-trailing--approved-meta">
          <div className="xchat-header-approved-meta-row">
            {showWorkspaceQuickNav ? (
              <nav className="xchat-header-workspace-quick-nav" aria-label="Workspace shortcuts">
                {showResourcesNav ? (
                  <XfHoverHint hint="Guides, docs, and workspace resources — educational reference only." showDelayMs={220}>
                    <Link className="xchat-header-workspace-quick-nav__link" href="/resources/guides">
                      <LucideBookOpenIcon aria-hidden className="xchat-header-workspace-quick-nav__glyph" />
                      <span>Resources</span>
                    </Link>
                  </XfHoverHint>
                ) : null}
                {showBrokerImportNav ? (
                  <XfHoverHint
                    hint="Upload broker CSV activity and reconcile custodian fills against your books."
                    showDelayMs={220}
                  >
                    <Link className="xchat-header-workspace-quick-nav__link" href="/import-activity">
                      <LucideUploadIcon aria-hidden className="xchat-header-workspace-quick-nav__glyph" />
                      <span>Broker import</span>
                    </Link>
                  </XfHoverHint>
                ) : null}
                {showTasksNav ? (
                  <XfHoverHint hint="Scheduled workspace tasks, reminders, and automation runs." showDelayMs={220}>
                    <Link className="xchat-header-workspace-quick-nav__link" href="/account/tasks">
                      <LucideClipboardListIcon aria-hidden className="xchat-header-workspace-quick-nav__glyph" />
                      <span>Tasks</span>
                    </Link>
                  </XfHoverHint>
                ) : null}
                {showAdminHubNav ? (
                  <XfHoverHint hint="Global admin console — tenants, access, personas, and ops tools." showDelayMs={220}>
                    <Link
                      className="xchat-header-workspace-quick-nav__link xchat-header-workspace-quick-nav__link--admin"
                      href="/admin"
                    >
                      <LucideSettingsIcon aria-hidden className="xchat-header-workspace-quick-nav__glyph" />
                      <span>Admin hub</span>
                    </Link>
                  </XfHoverHint>
                ) : null}
              </nav>
            ) : null}
            <WorkspaceRailAppearance variant="header" />
            {props.trailingExtras}
            {showTenantCard && tenantDesk?.tagline ? (
              <div className="xchat-header-tenant-card">
                <span className="xchat-header-tenant-card__name">{tenantDesk.primary}</span>
                <span className="xchat-header-tenant-card__tagline">{tenantDesk.tagline}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
