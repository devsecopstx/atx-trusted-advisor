import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { listPersonas } from "@/modules/xchat/repository";

import { AdminSessionPanel } from "../ui/admin-session-panel";
import { PersonasConsole } from "./ui/personas-console";

export default async function AdminPersonasPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden");
  }
  const personas = await listPersonas();
  const initialPersonas = personas.map((persona) => ({
    _id: persona._id?.toHexString(),
    name: persona.name,
    systemPrompt: persona.systemPrompt,
    overridePrompt: persona.overridePrompt ?? "",
    xaiCollection: {
      collectionId: persona.xaiCollection?.collectionId ?? "",
      collectionName: persona.xaiCollection?.collectionName
    },
    model: persona.model,
    temperature: persona.temperature,
    enableRag: persona.enableRag,
    defaultScope: persona.defaultScope,
    xaiCollectionVerification: persona.xaiCollectionVerification
      ? {
          ...persona.xaiCollectionVerification,
          checkedAt: persona.xaiCollectionVerification.checkedAt.toISOString()
        }
      : null
  }));

  return (
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">xPersona Configuration</h1>
            <p className="hero-copy">
              Create and review xPersona presets used by xchat across the admin workspace.
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

      <PersonasConsole initialPersonas={initialPersonas} />
    </main>
  );
}
