import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";
import { listRecommendationsForUser } from "@/modules/recommendations/repository";

import "../xchat/xchat.css";
import "./recommendations.css";
import { RecommendationsCreateForm } from "./ui/recommendations-create-form";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/recommendations");
  }

  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const items = await listRecommendationsForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    limit: 50
  });

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="recommendations" feedbackPageLabel="Recommendations" session={session} />

      <div className="xchat-body">
        <div className="recommendations-layout">
          <section className="hero-card xf-noise-overlay" style={{ marginBottom: "1rem" }}>
            <p className="eyebrow">App user</p>
            <h1 className="hero-title" style={{ fontSize: "1.35rem" }}>
              Recommendations
            </h1>
            <p className="hero-copy">
              Scoped notes and tags for your account. Creates publish a small event to Pub/Sub when configured so
              downstream agents can subscribe (see DEVELOPMENT.md).
            </p>
          </section>

          {items.length === 0 ? (
            <p className="status-text">No recommendations yet. Add one below.</p>
          ) : (
            <ul className="recommendations-list">
              {items.map((item) => {
                const id = item._id?.toHexString();
                if (!id) {
                  return null;
                }
                return (
                  <li className="recommendations-card" key={id}>
                    <h2 className="recommendations-card-title">{item.title}</h2>
                    <p className="recommendations-card-meta">
                      {item.status} · {item.source}
                      {item.scopeTags.length > 0 ? ` · ${item.scopeTags.join(", ")}` : ""}
                    </p>
                    {item.summary ? <p className="recommendations-card-summary">{item.summary}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}

          <RecommendationsCreateForm />
        </div>
      </div>
      <GlobalFooter />
    </div>
  );
}
