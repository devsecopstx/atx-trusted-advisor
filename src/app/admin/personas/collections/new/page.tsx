import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

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
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Create Collection</h1>
        <p className="hero-copy">
          Create xAI collections first, then bind them in persona create/edit pages.
        </p>
      </section>
      <CollectionEditorPage />
    </div>
  );
}
