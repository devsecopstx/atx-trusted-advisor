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
          Books in <code className="font-mono text-xs">tenant_portfolio</code> — edit names in the table, then{" "}
          <strong>Save changes</strong>.           Holdings CSV import:{" "}
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
