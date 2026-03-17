import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

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
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">xfinance core admin</p>
        <h1 className="hero-title">xPersona Config</h1>
        <p className="hero-copy">
          Manage xPersona prompts, tools, and collection bindings.
        </p>
      </section>

      <PersonasOnboardingHome />
    </div>
  );
}
