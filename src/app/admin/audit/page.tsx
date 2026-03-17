import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { AdminSessionPanel } from "../ui/admin-session-panel";
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
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">Audit Trail Explorer</h1>
            <p className="hero-copy">
              Search audit traces across users, access requests, and xPersonas.
            </p>
          </div>
          <AdminSessionPanel
            avatarUrl={session.avatarUrl}
            displayName={session.displayName}
            email={session.email}
            xUserId={session.xUserId}
            username={session.username}
          />
        </div>
      </section>

      <AuditConsole />
    </main>
  );
}
