import "./ui/marketing-hero.css";
import "./ui/product-plans.css";
import { MarketingHero } from "./ui/marketing-hero";
import { getSessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export default async function HomePage() {
  const session = await getSessionUser();

  const env = getEnv();
  const oauthStatus =
    env.X_OAUTH_CLIENT_ID.trim().length > 0 && env.X_OAUTH_CLIENT_SECRET.trim().length > 0
      ? "configured"
      : "not configured";

  return (
    <>
      <MarketingHero signedIn={Boolean(session)} />

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

          <div className="surface-grid two-col">
            <article className="surface-card xf-widget">
              <h3>atxFinance</h3>
              <p>
                Portfolio management, account configuration, watchlists, and strategy execution
                tools for approved finance professionals.
              </p>
            </article>
            <article className="surface-card xf-widget">
              <h3>xChat</h3>
              <p>xAI powered expert xFinance advisor.</p>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
