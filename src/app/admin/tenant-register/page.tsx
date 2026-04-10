import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { TenantRegisterConsole } from "./ui/tenant-register-console";

export default async function AdminTenantRegisterPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Tenant register</h1>
        <p className="hero-copy">
          Platform directory of <code className="text-sm">core_tenants</code> (id, slug, name, default flag), total
          membership count per tenant, optional xChat team KB collection name/id, stored{" "}
          <code className="text-sm">workspaceLimits</code> and <code className="text-sm">tenantPreferences</code> (as
          seeded or edited in admin), and each tenant&apos;s <code className="text-sm">tenant_admin</code> memberships
          with email and display name.{" "}
          <span style={{ color: "var(--xf-gain-green)" }} aria-hidden>
            ●
          </span>{" "}
          marks the user&apos;s default session tenant for that row.
        </p>
      </section>

      <TenantRegisterConsole />
    </div>
  );
}
