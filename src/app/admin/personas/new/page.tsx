import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getDefaultPersonaChatModelId } from "@/lib/xai-default-persona-model";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { PersonaEditorPage } from "../ui/persona-editor-page";

export default async function AdminCreatePersonaPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  const defaultChatModelId = getDefaultPersonaChatModelId();

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Create xPersona</h1>
        <p className="hero-copy">Create a persona in a dedicated onboarding step.</p>
      </section>
      <PersonaEditorPage defaultChatModelId={defaultChatModelId} mode="create" />
    </div>
  );
}
