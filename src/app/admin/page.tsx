import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getTenantShellBrandingForHexCached } from "@/lib/identity-shell-cache";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

import { AdminHubLaunchpad } from "./ui/admin-hub-launchpad";

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }

  const effectiveTenantId = await resolveTenantIdHexForGlobalAdminConsole(session.tenantId);
  const tenantMismatch =
    effectiveTenantId !== null &&
    effectiveTenantId.toLowerCase() !== session.tenantId.trim().toLowerCase();

  const tenantHex = effectiveTenantId ?? session.tenantId;
  const [branding, workspaceTenant] = await Promise.all([
    getTenantShellBrandingForHexCached(tenantHex),
    getWorkspaceTenantHeaderContext(tenantHex)
  ]);

  return (
    <div className="core-shell">
      <AdminHubLaunchpad
        effectiveTenantId={effectiveTenantId}
        sessionTenantId={session.tenantId}
        tenantAccent={branding?.accentColor ?? null}
        tenantMismatch={tenantMismatch}
        tenantName={workspaceTenant?.name ?? branding?.displayName ?? null}
        tenantSlug={workspaceTenant?.slug ?? null}
      />
    </div>
  );
}
