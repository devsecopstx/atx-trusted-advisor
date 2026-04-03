import { redirect } from "next/navigation";

import { AdminPortfolioScoringDefaultsPanel } from "@/app/admin/portfolio-scoring-defaults/ui/admin-portfolio-scoring-defaults-panel";
import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

export const dynamic = "force-dynamic";

export default async function AdminPortfolioScoringDefaultsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/portfolio-scoring-defaults");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="admin-page-stack admin-tenant-pref-page">
      <header>
        <p className="admin-session-popover__eyebrow">Books &amp; custody</p>
        <h1 className="admin-page-title">Portfolio scoring factors</h1>
        <p className="admin-muted" style={{ maxWidth: 720 }}>
          Tenant default weights for option-chain / recommendation ranking. Stored on{" "}
          <code className="font-mono text-xs">core_tenants.defaultPortfolioScoringFactors</code>. Portfolio-specific
          overrides remain on each book.
        </p>
      </header>
      <AdminPortfolioScoringDefaultsPanel tenantId={session.tenantId} />
    </div>
  );
}
