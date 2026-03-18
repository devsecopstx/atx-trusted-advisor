import "./ui/marketing-hero.css";
import "./ui/product-plans.css";
import { MarketingHero } from "./ui/marketing-hero";
import { ProductPlans } from "./ui/product-plans";

export default function HomePage() {
  return (
    <>
      <MarketingHero />

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
              <p>
                AI-powered advisor with persona-driven tools, xAI collection RAG, and real-time
                atxFinance data access via the atxfinance tool.
              </p>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
