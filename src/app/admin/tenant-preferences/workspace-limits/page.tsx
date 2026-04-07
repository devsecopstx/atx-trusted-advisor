import { redirect } from "next/navigation";

import { TenantWorkspaceLimitsPanel } from "@/app/admin/tenant-preferences/ui/tenant-workspace-limits-panel";
import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

export const dynamic = "force-dynamic";

export default async function AdminTenantWorkspaceLimitsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  const resolvedTenantId = await resolveTenantIdHexForGlobalAdminConsole(session.tenantId);
  if (!resolvedTenantId) {
    redirect("/admin?error=no-tenant");
  }

  return (
    <div className="admin-page-stack admin-tenant-pref-page">
      <header>
        <p className="admin-session-popover__eyebrow">Tenant preferences</p>
        <h1 className="admin-page-title">Workspace limits</h1>
        <p className="admin-muted" style={{ maxWidth: 720 }}>
          Per-tenant quotas on <code className="font-mono text-xs">core_tenants.workspaceLimits</code>. Enforcement:
          xChat ask, portfolio/account APIs, signed-in xoptions. One row = this session tenant; use{" "}
          <strong>Reload</strong> to discard unsaved edits, <strong>Reset draft</strong> for default numbers, then{" "}
          <strong>Save</strong>.
        </p>
      </header>
      <TenantWorkspaceLimitsPanel tenantId={resolvedTenantId} />
    </div>
  );
}
