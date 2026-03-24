import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { BrokerHoldingsImportPanel } from "../portfolios/ui/broker-holdings-import-panel";

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
        <h1 className="hero-title">Onboarding — broker holdings import</h1>
        <p className="hero-copy">
          Map custodian CSV exports to core accounts for a tenant portfolio. Uses{" "}
          <code className="font-mono text-xs">POST /api/admin/import/broker</code> (Merrill / Fidelity holdings).
          Ensure portfolios and accounts exist under{" "}
          <Link className="login-xoptions-link" href="/admin/portfolios">
            Portfolios
          </Link>{" "}
          before importing.
        </p>
      </section>

      <BrokerHoldingsImportPanel />
    </div>
  );
}
