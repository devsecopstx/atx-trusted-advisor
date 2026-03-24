import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminAccountsPortfolioPicker } from "./ui/admin-accounts-portfolio-picker";

export default async function AdminAccountsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/accounts");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Accounts</h1>
        <p className="hero-copy">
          Pick a portfolio below, or start from{" "}
          <Link className="login-xoptions-link" href="/admin/portfolios">
            Portfolios
          </Link>
          . Each book supports custodian CRUD, cash, defaults, and book-level risk &amp; outlook. Use{" "}
          <Link className="login-xoptions-link" href="/admin/broker-import">
            Broker import
          </Link>{" "}
          for Merrill / Fidelity holdings CSV.
        </p>
        <div className="tool-row" style={{ marginTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link className="cta cta-primary" href="/admin/portfolios">
            Open portfolios
          </Link>
          <Link className="cta cta-secondary" href="/admin/broker-import">
            Broker import hub
          </Link>
          <Link className="cta cta-secondary" href="/admin/onboarding">
            Onboarding
          </Link>
        </div>
      </section>

      <AdminAccountsPortfolioPicker />
    </div>
  );
}
