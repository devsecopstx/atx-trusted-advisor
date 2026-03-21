import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { PortfolioConsole } from "./ui/portfolio-console";

export default async function AdminPortfoliosPage() {
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
        <h1 className="hero-title">Tenant portfolios</h1>
        <p className="hero-copy">
          Per-user workspace portfolios live in Mongo <code className="font-mono text-xs">tenant_portfolios</code>{" "}
          (legacy <code className="font-mono text-xs">portfolio_portfolios</code>). Each app user’s default portfolio
          is tagged with <code className="font-mono text-xs">tenantPortfolioOrgKey</code> (default{" "}
          <code className="font-mono text-xs">org-atx-finance</code>) under your{" "}
          <code className="font-mono text-xs">core_tenants</code> scope — this instance’s client data bucket.
        </p>
      </section>

      <PortfolioConsole />
    </div>
  );
}
