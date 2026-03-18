import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { CollectionBindingEditorPage } from "../../../ui/collection-binding-editor-page";

type RouteContext = {
  params: Promise<{ collectionId: string }>;
};

export default async function AdminEditCollectionPage({ params }: RouteContext) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.roles.includes("global_admin")) {
    redirect("/admin?error=forbidden");
  }
  const { collectionId } = await params;

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Edit Collection Binding</h1>
        <p className="hero-copy">
          Assign this collection to a persona from a dedicated collection edit page.
        </p>
      </section>
      <CollectionBindingEditorPage collectionId={collectionId} />
    </div>
  );
}
