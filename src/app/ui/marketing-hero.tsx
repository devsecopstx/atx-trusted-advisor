import { XFinanceLogo } from "./xfinance-logo";

function XFinanceIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mh-product-icon"
      fill="none"
      viewBox="0 0 64 64"
    >
      <rect x="6" y="12" width="52" height="40" rx="6" stroke="var(--xf-text-300)" strokeWidth="1.5" />
      <path d="M6 24h52" stroke="var(--xf-text-300)" strokeWidth="1.5" />
      <rect x="14" y="30" width="12" height="6" rx="2" fill="rgba(255,255,255,0.06)" stroke="var(--xf-text-300)" strokeWidth="1" />
      <rect x="14" y="40" width="12" height="6" rx="2" fill="rgba(255,255,255,0.06)" stroke="var(--xf-text-300)" strokeWidth="1" />
      <path d="M34 33l5 4 9-10" stroke="var(--xf-gain-green)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function XChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mh-product-icon"
      fill="none"
      viewBox="0 0 64 64"
    >
      <path
        d="M10 14a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H28l-10 8v-8h-2a6 6 0 0 1-6-6V14z"
        stroke="var(--xf-text-300)"
        strokeWidth="1.5"
      />
      <circle cx="24" cy="26" r="2" fill="var(--xf-text-300)" />
      <circle cx="32" cy="26" r="2" fill="var(--xf-text-300)" />
      <circle cx="40" cy="26" r="2" fill="var(--xf-text-300)" />
      <path d="M38 52l6-6h6a4 4 0 0 0 4-4" stroke="var(--xf-gain-green)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ProductCard(props: { icon: React.ReactNode; name: string; description: string }) {
  return (
    <div className="mh-product-card">
      {props.icon}
      <div className="mh-product-copy">
        <strong>{props.name}</strong>
        <span>{props.description}</span>
      </div>
    </div>
  );
}

export function MarketingHero() {
  return (
    <section className="mh-hero">
      <div className="mh-grid-lines" aria-hidden="true" />
      <div className="mh-circuit-dots" aria-hidden="true" />

      <div className="mh-content">
        <div className="mh-left">
          <XFinanceLogo size="md" showSubtitle />
          <p className="mh-descriptor">
            AI-native software &amp; services for finance professionals
          </p>

          <h1 className="mh-tagline">
            No Atoms Moved.{" "}
            <br />
            Just <span className="mh-tagline-glow">Gains</span> Earned.
          </h1>

          <p className="mh-sub">
            Institutional-grade tools powered by xAI.
            Private dark-launch — approved access only.
          </p>

          <div className="mh-badges">
            <span className="mh-badge mh-badge-grok">
              Powered by Grok
            </span>
            <span className="mh-badge">
              xAI Collection RAG
            </span>
            <span className="mh-badge">
              Dark Launch
            </span>
          </div>

          <div className="mh-cta-row">
            <a className="mh-cta-primary" href="/login">
              xFinance Advisory
            </a>
            <a className="mh-cta-secondary" href="/admin">
              Admin Console
            </a>
          </div>
        </div>

        <div className="mh-right">
          <div className="mh-product-stack">
            <ProductCard
              icon={<XFinanceIcon />}
              name="xFinance"
              description="Portfolio management, watchlists, accounts, and strategy execution for finance professionals."
            />
            <ProductCard
              icon={<XChatIcon />}
              name="xChat"
              description="AI advisor with persona-driven tools, RAG context, and real-time xFinance data access."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
