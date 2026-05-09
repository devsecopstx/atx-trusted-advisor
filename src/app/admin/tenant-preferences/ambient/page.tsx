import { redirect } from "next/navigation";

import { AmbientExperiencePanel } from "@/app/admin/tenant-preferences/ui/ambient-experience-panel";
import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

export const dynamic = "force-dynamic";

export default async function AdminTenantAmbientExperiencePage() {
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
        <h1 className="admin-page-title">Ambient experience</h1>
        <p className="admin-muted" style={{ maxWidth: 720 }}>
          Decorative ambient layers behind app_user product chrome — currently the{" "}
          <strong>Ambient Market Veil</strong> background on{" "}
          <code className="font-mono text-xs">/xchat</code>,{" "}
          <code className="font-mono text-xs">/xoptions</code>, and{" "}
          <code className="font-mono text-xs">/portfolios</code>. Stored on{" "}
          <code className="font-mono text-xs">core_tenants.tenantPreferences.ambient_market_veil</code> (default-on).
        </p>
      </header>
      <AmbientExperiencePanel tenantId={resolvedTenantId} />
    </div>
  );
}
