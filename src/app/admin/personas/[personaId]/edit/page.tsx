import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { EditPersonaEditorClient } from "./edit-persona-editor-client";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

export default async function AdminEditPersonaPage({ params }: RouteContext) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { personaId } = await params;

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Edit xPersona</h1>
        <p className="hero-copy">Edit a persona in a dedicated page for complex settings.</p>
      </section>
      <EditPersonaEditorClient personaId={personaId} />
    </div>
  );
}
