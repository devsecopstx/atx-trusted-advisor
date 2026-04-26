import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { TenantRolesMatrixConsole } from "./ui/tenant-roles-matrix-console";

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

export const dynamic = "force-dynamic";

export default async function AdminTenantRolesMatrixPage(props: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { tenantId } = await props.params;
  const id = typeof tenantId === "string" ? tenantId.trim() : "";
  if (!id) {
    redirect("/admin/tenant-register");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Tenant roles matrix</h1>
        <p className="hero-copy" style={{ maxWidth: 760 }}>
          Per-role route policy matrix for tenant <code className="font-mono text-sm">{id}</code>. Save applies
          directly to <code className="font-mono text-sm">core_tenants.tenantRoles</code> via
          <code className="font-mono text-sm"> /api/admin/tenants/{`{tenantId}`}/roles</code>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="cta cta-secondary text-sm" href={`/admin/tenant-register/${encodeURIComponent(id)}/workspace-limits`}>
            Workspace limits
          </Link>
          <Link className="cta cta-secondary text-sm" href="/admin/tenant-register">
            Tenant register
          </Link>
        </div>
      </section>
      <TenantRolesMatrixConsole tenantId={id} />
    </div>
  );
}
