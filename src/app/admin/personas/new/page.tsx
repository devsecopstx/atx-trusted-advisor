import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { PersonaEditorPage } from "../ui/persona-editor-page";

export default async function AdminCreatePersonaPage() {
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
        <h1 className="hero-title">Create xPersona</h1>
        <p className="hero-copy">Create a persona in a dedicated onboarding step.</p>
      </section>
      <PersonaEditorPage mode="create" />
    </div>
  );
}
