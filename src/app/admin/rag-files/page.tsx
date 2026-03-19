import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { RagFilesConsole } from "./ui/rag-files-console";

export default async function AdminRagFilesPage() {
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
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">RAG collections</h1>
        <p className="hero-copy">
          Read-only view of xAI collections visible to this app&apos;s management API key (team scope).
        </p>
      </section>

      <RagFilesConsole />
    </div>
  );
}
