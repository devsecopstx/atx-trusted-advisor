"use client";

import Link from "next/link";

import type { SessionUser } from "@/lib/auth";
import type { WorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

import type { AppUserProductNavCurrent } from "./app_user-product-nav";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "./product-brand-constants";
import { useTenantShellBranding } from "./tenant-branding-context";
import { XchatHeaderBrand } from "./xchat-header-brand";

type AppUserApprovedHeaderProps = {
  session: SessionUser;
  current: AppUserProductNavCurrent;
  /** Kept for call-site compatibility; account feedback uses the sidebar or pathname. */
  feedbackPageLabel?: string;
  /**
   * When set (e.g. from `getWorkspaceTenantHeaderContext`), show the same tenant display name as `/portfolios`.
   */
  workspaceTenant?: WorkspaceTenantHeaderContext | null;
};

export function AppUserApprovedHeader(props: AppUserApprovedHeaderProps) {
  void props.current;
  void props.feedbackPageLabel;

  const ws = props.workspaceTenant;
  const branding = useTenantShellBranding();

  const tenantTitle = props.session.tenantId?.trim() ?? "";
  const showTenantCard = Boolean(ws || branding?.tagline);

  return (
    <header className="xchat-header">
      <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URLs + arbitrary tenant CDNs
          <img
            alt=""
            className="xchat-header-tenant-logo xchat-header-tenant-logo--header-compact"
            height={28}
            src={branding.logoUrl}
            width={28}
          />
        ) : (
          <XchatHeaderBrand compact />
        )}
      </Link>
      <div className="xchat-header-main">
        <div className="xchat-header-trailing xchat-header-trailing--approved-meta">
          <span className="xchat-header-xai-badge" title="Advisory models powered by xAI">
            xAI Powered
          </span>
          {showTenantCard ? (
            <div className="xchat-header-tenant-card" title={tenantTitle}>
              {ws ? (
                <>
                  <span className="xchat-header-tenant-card__name">{ws.name}</span>
                  {branding?.tagline ? (
                    <span className="xchat-header-tenant-card__tagline">{branding.tagline}</span>
                  ) : null}
                </>
              ) : branding?.tagline ? (
                <span className="xchat-header-tenant-card__tagline">{branding.tagline}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
