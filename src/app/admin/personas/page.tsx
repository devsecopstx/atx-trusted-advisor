import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { AdminSessionPanel } from "../ui/admin-session-panel";
import { PersonasOnboardingHome } from "./ui/personas-onboarding-home";

export default async function AdminPersonasPage() {
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
            <h1 className="hero-title">xPersona Onboarding</h1>
            <p className="hero-copy">
              Follow a clean flow: review personas/collections, then create or edit in dedicated pages.
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

      <PersonasOnboardingHome />
    </main>
  );
}
