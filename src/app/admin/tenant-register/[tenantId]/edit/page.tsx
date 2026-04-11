import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { EditTenantConsole } from "./ui/edit-tenant-console";

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function AdminEditTenantPage(props: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  const { tenantId } = await props.params;

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Edit tenant</h1>
        <p className="hero-copy">
          Update <code className="text-sm">tenantPreferences</code> for accent, palette, and default shell theme. Use{" "}
          <Link
            className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
            href={`/admin/tenant-register/${encodeURIComponent(tenantId)}/workspace-limits`}
          >
            Workspace limits
          </Link>{" "}
          for quotas (xChat, xOptions, portfolios) and plan overrides for this tenant.
        </p>
      </section>

      <EditTenantConsole key={tenantId} />
    </div>
  );
}
