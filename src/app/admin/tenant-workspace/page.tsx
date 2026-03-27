import { redirect } from "next/navigation";

import { TenantWorkspaceLimitsPanel } from "@/app/admin/tenant-workspace/ui/tenant-workspace-limits-panel";
import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

export default async function AdminTenantWorkspacePage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  return (
    <div className="admin-page-stack" style={{ maxWidth: 720 }}>
      <header>
        <p className="admin-session-popover__eyebrow">Books &amp; custody</p>
        <h1 className="admin-page-title">Tenant workspace limits</h1>
        <p className="admin-muted" style={{ maxWidth: 560 }}>
          Per-tenant quotas stored on <code className="font-mono text-xs">core_tenants.workspaceLimits</code>. Defaults:
          xoptions 10/day, xChat 10/day (min with plan), 1 portfolio per user, 1 account per portfolio. Enforcement is
          server-side on xChat ask, portfolio/account APIs, and signed-in xoptions deck views.
        </p>
      </header>
      <TenantWorkspaceLimitsPanel tenantId={session.tenantId} />
    </div>
  );
}
