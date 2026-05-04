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

  return (
    <header className="xchat-header">
      <div className="xchat-header-leading">
        <div className="xchat-header-brand-stack">
          <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URLs + arbitrary tenant CDNs
              <img
                alt=""
                className="xchat-header-tenant-logo"
                height={36}
                src={branding.logoUrl}
                width={36}
              />
            ) : (
              <XchatHeaderBrand />
            )}
          </Link>
          {ws ? (
            <span className="xchat-header-tenant-under-brand" title={props.session.tenantId?.trim() ?? ""}>
              <span className="xchat-header-tenant-under-brand__name">{ws.name}</span>
              {branding?.tagline ? (
                <span className="xchat-header-tenant-under-brand__tagline">{branding.tagline}</span>
              ) : null}
            </span>
          ) : branding?.tagline ? (
            <span className="xchat-header-tenant-under-brand">
              <span className="xchat-header-tenant-under-brand__tagline">{branding.tagline}</span>
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
