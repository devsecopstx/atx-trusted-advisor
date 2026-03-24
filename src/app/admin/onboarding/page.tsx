import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

export default async function AdminOnboardingPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/onboarding");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Onboarding</h1>
        <p className="hero-copy">
          Broker <strong>holdings</strong> CSV import now lives on the dedicated{" "}
          <Link className="login-xoptions-link" href="/admin/broker-import">
            Broker import
          </Link>{" "}
          hub (<code className="font-mono text-xs">POST /api/admin/import/broker</code>). Ensure portfolios and accounts
          exist under{" "}
          <Link className="login-xoptions-link" href="/admin/accounts">
            Accounts
          </Link>{" "}
          or{" "}
          <Link className="login-xoptions-link" href="/admin/portfolios">
            Portfolios
          </Link>{" "}
          before importing.
        </p>
        <div className="tool-row" style={{ marginTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link className="cta cta-primary" href="/admin/broker-import">
            Broker import hub
          </Link>
          <Link className="cta cta-secondary" href="/admin/accounts">
            Accounts
          </Link>
          <Link className="cta cta-secondary" href="/admin/portfolios">
            Portfolios
          </Link>
        </div>
      </section>
    </div>
  );
}
