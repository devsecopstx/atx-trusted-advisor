import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { AdminSessionPanel } from "../../../ui/admin-session-panel";
import { PersonaEditorPage } from "../../ui/persona-editor-page";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

export default async function AdminEditPersonaPage({ params }: RouteContext) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden");
  }
  const { personaId } = await params;

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">Edit xPersona</h1>
            <p className="hero-copy">Edit a persona in a dedicated page for complex settings.</p>
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
      <PersonaEditorPage mode="edit" personaId={personaId} />
    </main>
  );
}
