import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { UserSettingsConsole } from "./ui/user-settings-console";

export default async function AdminUserSettingsPage() {
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
        <h1 className="hero-title">User Settings</h1>
        <p className="hero-copy">
          Upsert default broker, portfolio, account, and notification settings for a user.
        </p>
      </section>

      <UserSettingsConsole />
    </div>
  );
}
