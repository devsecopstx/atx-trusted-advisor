import { redirect } from "next/navigation";

import { UnifiedTenantPreferencesClient } from "@/app/admin/tenant-preferences/ui/unified-tenant-preferences-client";
import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

export const dynamic = "force-dynamic";

export default async function AdminTenantPreferencesPage() {
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
        <h1 className="admin-page-title">Tenant preferences</h1>
        <p className="admin-muted" style={{ maxWidth: 720 }}>
          Unified configuration for workspace limits, ambient experience, default xChat persona, and
          feature flags. Select a tenant, edit sections, then save.
        </p>
      </header>
      <UnifiedTenantPreferencesClient defaultTenantId={resolvedTenantId} />
    </div>
  );
}
