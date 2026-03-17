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
    redirect("/admin?error=forbidden&target=personas");
  }

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">xPersona Onboarding</h1>
            <p className="hero-copy">
              Configure xPersona first, then set up collections or personas in dedicated pages. After
              that, xchat usage is allowed.
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
