import Link from "next/link";

import type { SessionUser } from "@/lib/auth";
import { tenantIdHexLastFourUserFacing } from "@/lib/mongo-object-id-hex";
import type { WorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

import type { AppUserProductNavCurrent } from "./app_user-product-nav";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "./product-brand-constants";
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

  const tenantHex = props.session.tenantId?.trim() ?? "";
  const tenantFacing = tenantHex ? tenantIdHexLastFourUserFacing(tenantHex) : "";
  const ws = props.workspaceTenant;

  return (
    <header className="xchat-header">
      <div className="xchat-header-leading">
        <div className="xchat-header-brand-stack">
          <Link aria-label={USER_PRODUCT_HOME_ARIA_LABEL} className="xchat-header-brand" href="/xchat">
            <XchatHeaderBrand />
          </Link>
          {ws ? (
            <span className="xchat-header-tenant-under-brand" title={tenantHex}>
              <span className="xchat-header-tenant-under-brand__name">{ws.name}</span>
            </span>
          ) : tenantFacing ? (
            <span
              className="xchat-header-tenant-under-brand xchat-header-tenant-under-brand--chip font-mono"
              title={`Tenant id ${tenantHex}`}
            >
              Tenant {tenantFacing}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
