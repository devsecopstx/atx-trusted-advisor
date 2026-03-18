import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { AuditConsole } from "./ui/audit-console";

export default async function AdminAuditPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden");
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">xfinance core admin</p>
        <h1 className="hero-title">Audit Trail Explorer</h1>
        <p className="hero-copy">
          Search audit traces across users, access requests, and xPersonas.
        </p>
      </section>

      <AuditConsole />
    </div>
  );
}
