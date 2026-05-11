import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { UserSettingsConsole } from "./ui/user-settings-console";

import "./admin-users-directory.css";

export default async function AdminManageUsersPage() {
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
        <h1 className="hero-title">Manage Users &amp; Access</h1>
        <p className="hero-copy">
          Browse users and open access requests together, approve access, assign roles and plans, and edit
          per-user broker, portfolio, account, and notification defaults from the side panel.
        </p>
      </section>

      <UserSettingsConsole />
    </div>
  );
}
