import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { RagFilesConsole } from "./ui/rag-files-console";

export default async function AdminRagFilesPage() {
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
        <h1 className="hero-title">RAG collections</h1>
        <p className="hero-copy">
          View xAI collections in team scope and remove selected collections from this admin-only page.
        </p>
      </section>

      <RagFilesConsole />
    </div>
  );
}
