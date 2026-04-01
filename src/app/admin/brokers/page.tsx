import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AdminBrokersCrud } from "./ui/admin-brokers-crud";

export default async function AdminBrokersPage() {
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
        <h1 className="hero-title">Manage Brokers</h1>
        <p className="hero-copy">
          Define custodian <strong>type</strong> slugs (stored on <strong>accounts</strong> as{" "}
          <code className="font-mono text-xs">type</code>), human-readable <strong>name</strong>, optional{" "}
          <strong>description</strong>, and <strong>icon URL</strong> for this console. Defaults seed Merrill, Fidelity,
          E*TRADE, and Interactive Brokers (IBKR) when the catalog is empty.
        </p>
      </section>

      <AdminBrokersCrud />
    </div>
  );
}
