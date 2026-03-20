import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { MarketingHero } from "./ui/marketing-hero";
import "./ui/marketing-hero.css";
import "./ui/product-plans.css";
export default async function HomePage() {
  const session = await getSessionUser();
  const adminSession = session ? isGlobalAdmin(session.roles) : false;

  if (session && !adminSession) {
    redirect("/xchat");
  }

  const env = getEnv();
  const oauthStatus =
    env.X_OAUTH_CLIENT_ID.trim().length > 0 && env.X_OAUTH_CLIENT_SECRET.trim().length > 0
      ? "configured"
      : "not configured";

  return (
    <>
      <MarketingHero isGlobalAdmin={adminSession} signedIn={Boolean(session)} />

      <div className="core-shell">
        <section className="panel">
          <header className="panel-header">
            <h2>Platform Status</h2>
            <p>Private dark-launch — approved access only.</p>
          </header>

          <div className="badge-wrap" style={{ marginBottom: "0.5rem" }}>
            <span className="status-badge status-live">API live</span>
            <span
              className={`status-badge ${oauthStatus === "configured" ? "status-ready" : "status-warn"}`}
            >
              X OAuth {oauthStatus}
            </span>
            <span className="status-badge">Dark Launch</span>
          </div>
        </section>
      </div>
    </>
  );
}
