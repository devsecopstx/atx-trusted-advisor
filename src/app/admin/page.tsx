import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

import { ADMIN_FUNCTION_GROUPS } from "./ui/admin-hub-sections";
import { AdminOpsSummaryPanel } from "./ui/admin-ops-summary-panel";
import { TenantUxFailClosedDrillToggle } from "./ui/tenant-ux-fail-closed-drill-toggle";
import { TenantUxObservabilityPanel } from "./ui/tenant-ux-observability-panel";

export default async function AdminPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }

  const effectiveTenantId = await resolveTenantIdHexForGlobalAdminConsole(session.tenantId);
  const tenantMismatch =
    effectiveTenantId !== null &&
    effectiveTenantId.toLowerCase() !== session.tenantId.trim().toLowerCase();

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Admin Control Center</h1>
        <p className="hero-copy">
          Navigation is now pinned in the left rail. Admin-only sections group every Hub function for faster desktop
          workflows.
        </p>
      </section>

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Tenant</h2>
          <p>
            <code className="text-sm">core_tenants</code> ObjectId (24-char hex) tied to this session. Use for support,
            workspace limits, and multi-tenant debugging.
          </p>
        </div>
        <dl className="grid gap-3 text-sm md:grid-cols-[minmax(8rem,auto)_1fr] md:gap-x-4">
          <dt className="font-medium text-[var(--xf-text-300)]">Session tenant id</dt>
          <dd>
            <code className="break-all rounded bg-[var(--xf-surface-800)] px-2 py-1 text-xs">{session.tenantId}</code>
          </dd>
          <dt className="font-medium text-[var(--xf-text-300)]">Effective tenant id</dt>
          <dd>
            {effectiveTenantId ? (
              <code className="break-all rounded bg-[var(--xf-surface-800)] px-2 py-1 text-xs">{effectiveTenantId}</code>
            ) : (
              <span className="status-text status-error">Could not resolve a tenant in this database.</span>
            )}
          </dd>
        </dl>
        {tenantMismatch ? (
          <p className="status-text status-warn text-sm">
            Session tenant id does not match an existing row; the admin console falls back to the effective tenant above
            (for example after re-seeding or changing <code className="text-xs">MONGODB_URI</code>). Sign out and sign
            back in to refresh the session if needed.
          </p>
        ) : null}
      </section>

      <AdminOpsSummaryPanel />
      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Tenant UX enforcement drills</h2>
          <p>
            Keep production fail-open defaults for soak while allowing targeted fail-closed simulation from admin.
          </p>
        </div>
        <TenantUxFailClosedDrillToggle />
      </section>
      <TenantUxObservabilityPanel />

      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Sections in rail</h2>
          <p>Use the persistent left rail to open each admin area.</p>
        </div>
        <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
          {ADMIN_FUNCTION_GROUPS.map((group) => (
            <span className="status-badge status-pending" key={group.title}>
              {group.title}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
