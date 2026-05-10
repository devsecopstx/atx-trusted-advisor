import Link from "next/link";
import { redirect } from "next/navigation";

import { TenantWorkspaceLimitsPanel } from "@/app/admin/tenant-preferences/ui/tenant-workspace-limits-panel";
import { TenantBootstrapAuditPanel } from "@/app/admin/tenant-register/ui/tenant-bootstrap-audit-panel";
import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function AdminTenantRegisterWorkspaceLimitsPage(props: PageProps) {
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
        <h1 className="hero-title">Workspace limits</h1>
        <p className="hero-copy" style={{ maxWidth: 720 }}>
          Quotas and preferences for tenant <code className="font-mono text-sm">{id}</code>. Same panel as{" "}
          <Link
            className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
            href="/admin/tenant-preferences/workspace-limits"
          >
            Tenant preferences → Workspace limits
          </Link>
          , which only edits your <strong>current session</strong> tenant — this URL targets any tenant by id.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="cta cta-secondary text-sm"
            href={`/admin/tenant-register/${encodeURIComponent(id)}/edit`}
          >
            ← Edit tenant branding
          </Link>
          <Link className="cta cta-secondary text-sm" href="/admin/tenant-register">
            Tenant register
          </Link>
        </div>
      </section>

      <div className="admin-page-stack admin-tenant-pref-page">
        <TenantWorkspaceLimitsPanel tenantId={id} />
        <TenantBootstrapAuditPanel tenantId={id} />
      </div>
    </div>
  );
}
