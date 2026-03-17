import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { AdminSessionPanel } from "../../../ui/admin-session-panel";
import { CollectionEditorPage } from "../../ui/collection-editor-page";

export default async function AdminCreateCollectionPage() {
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
            <h1 className="hero-title">Create Collection</h1>
            <p className="hero-copy">
              Create xAI collections first, then bind them in persona create/edit pages.
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
      <CollectionEditorPage />
    </main>
  );
}
