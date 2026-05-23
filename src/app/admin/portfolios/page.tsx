import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { TenantPortfoliosIcon } from "@/app/admin/ui/tenant-portfolios-icon";

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
        <p className="eyebrow">aTx Trusted Advisory · admin</p>
        <h1 className="hero-title" style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
          <span className="admin-page-hero-mark" aria-hidden>
            <TenantPortfoliosIcon width={34} height={34} />
          </span>
          Tenant portfolios
        </h1>
        <p className="hero-copy">
          <strong>API-first.</strong> Portfolios are created and managed through{" "}
          <code className="font-mono text-xs">GET</code> / <code className="font-mono text-xs">POST</code>{" "}
          <code className="font-mono text-xs">/api/admin/portfolios</code> and{" "}
          <code className="font-mono text-xs">GET</code> / <code className="font-mono text-xs">PATCH</code> /{" "}
          <code className="font-mono text-xs">DELETE</code>{" "}
          <code className="font-mono text-xs">{"/api/admin/portfolios/{portfolioId}"}</code> (session:{" "}
          <code className="font-mono text-xs">global_admin</code>). OpenAPI inventory:{" "}
          <code className="font-mono text-xs">GET /api/openapi</code>.
        </p>
        <p className="hero-copy" style={{ marginTop: "0.65rem" }}>
          <strong>Flow:</strong> use the table below for full CRUD — edit rows and <strong>Save all changes</strong>,
          create a book under <strong>New portfolio</strong>, or remove a row with <strong>Delete</strong>. Open{" "}
          <strong>Tools</strong> on a row for watchlist, accounts, scoring, alerts, recommendations, delivery
          channels, and broker import for that book. Per-user workspace data lives in{" "}
          <code className="font-mono text-xs">tenant_portfolio</code> with{" "}
          <code className="font-mono text-xs">tenantPortfolioOrgKey</code> (default{" "}
          <code className="font-mono text-xs">org-atx-finance</code>). Global holdings CSV hub:{" "}
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
