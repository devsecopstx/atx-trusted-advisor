import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { BackofficeMongoConsole } from "./ui/backoffice-mongo-console";

export default async function AdminManageBackofficePage() {
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
        <h1 className="hero-title">Manage backoffice</h1>
        <p className="hero-copy">
          Constrained <code className="text-sm">core_users</code> lookup and patches (plan, status, roles, email, X
          profile, xAI collection hints). Audited — not a raw Mongo shell.
        </p>
      </section>

      <BackofficeMongoConsole />
    </div>
  );
}
