import { redirect } from "next/navigation";

import { XchatDefaultPersonaPanel } from "@/app/admin/tenant-preferences/ui/xchat-default-persona-panel";
import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

export default async function AdminTenantDefaultPersonaPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/xchat");
  }

  return (
    <div className="admin-page-stack admin-tenant-pref-page">
      <header>
        <p className="admin-session-popover__eyebrow">Tenant preferences</p>
        <h1 className="admin-page-title">Default xChat persona</h1>
        <p className="admin-muted" style={{ maxWidth: 720 }}>
          Platform default for app users without an admin-assigned persona. Stored in admin xChat settings (not
          per-tenant document).
        </p>
      </header>
      <XchatDefaultPersonaPanel />
    </div>
  );
}
