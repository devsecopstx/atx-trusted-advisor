import Link from "next/link";
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
        <p className="eyebrow">atx Trusted Advisor · admin</p>
        <h1 className="hero-title">Tenant portfolios</h1>
        <p className="hero-copy">
          <strong>Private / Secure</strong> — Per-user workspace portfolios live in{" "}
          <code className="font-mono text-xs">tenant_portfolio</code>. Each app user&apos;s default portfolio is
          tagged with <code className="font-mono text-xs">tenantPortfolioOrgKey</code> (default{" "}
          <code className="font-mono text-xs">org-atx-finance</code>) under your{" "}
          <code className="font-mono text-xs">core_tenants</code> scope — this instance&apos;s client data bucket.
        </p>
        <p className="hero-copy" style={{ marginTop: "0.65rem" }}>
          Edit book names in the table, then <strong>Save changes</strong>. Per-book{" "}
          <strong>strategy scoring</strong> weights (IV rank, OI, volume, liquidity, portfolio fit, alignment) live
          under each row&apos;s <strong>Scoring</strong> link. Holdings CSV:{" "}
          <Link className="underline font-medium" href="/admin/broker-import">
            Broker import
          </Link>
          .
        </p>
      </section>

      <PortfolioConsole />
    </div>
  );
}
