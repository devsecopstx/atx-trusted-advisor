import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AuditConsole } from "./ui/audit-console";

export default async function AdminAuditPage() {
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
        <h1 className="hero-title">Audit Trail Explorer</h1>
        <p className="hero-copy">
          Search audit traces across users, access requests, and xPersonas. For same-day sign-in attempts, use{" "}
          <Link className="text-[var(--xf-gain-green)] underline" href="/admin/logins-today">
            Logins today
          </Link>
          .
        </p>
      </section>

      <AuditConsole />
    </div>
  );
}
