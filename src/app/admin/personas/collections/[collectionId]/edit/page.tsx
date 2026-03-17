import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { AdminSessionPanel } from "../../../../ui/admin-session-panel";
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
    <main className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <div className="hero-top">
          <div>
            <p className="eyebrow">xfinance core admin</p>
            <h1 className="hero-title">Edit Collection Binding</h1>
            <p className="hero-copy">
              Assign this collection to a persona from a dedicated collection edit page.
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
      <CollectionBindingEditorPage collectionId={collectionId} />
    </main>
  );
}
