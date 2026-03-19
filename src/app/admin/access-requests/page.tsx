import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { AccessRequestsConsole } from "./ui/access-requests-console";

export default async function AdminAccessRequestsPage() {
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
        <h1 className="hero-title">Access Requests</h1>
        <p className="hero-copy">
          Review pending approvals and quickly create a new role request for a user.
        </p>
      </section>

      <AccessRequestsConsole />
    </div>
  );
}
