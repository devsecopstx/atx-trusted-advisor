import Link from "next/link";

import { AtxFinanceLogo } from "./atxfinance-logo";

function AtxFinanceIcon() {
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

function XStrategyBuilderIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mh-product-icon"
      fill="none"
      viewBox="0 0 64 64"
    >
      <path d="M10 48l10-14 10 8 14-20 10 10" stroke="var(--xf-text-300)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 52h44" stroke="var(--xf-text-300)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="30" cy="42" r="3.2" fill="none" stroke="var(--xf-gain-green)" strokeWidth="1.8" />
      <path d="M44 18h10v10" stroke="var(--xf-gain-green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

type MarketingHeroProps = {
  signedIn?: boolean;
  /** Only global admins see the admin console entry and full product shortcuts on `/`. */
  isGlobalAdmin?: boolean;
};

export function MarketingHero({ signedIn = false, isGlobalAdmin = false }: MarketingHeroProps) {
  return (
    <section className="mh-hero">
      <div className="mh-grid-lines" aria-hidden="true" />
      <div className="mh-circuit-dots" aria-hidden="true" />

      <div className="mh-content">
        <div className="mh-left">
          <AtxFinanceLogo size="md" showSubtitle />
          <p className="mh-descriptor">xFinance · xChat · xStrategyBuilder — institutional options alpha in one workspace.</p>

          <h1 className="mh-tagline">
            No Atoms Moved.{" "}
            <br />
            Just <span className="mh-tagline-glow">Gains</span> Earned.
          </h1>

          <p className="mh-sub">Institutional-grade options tooling powered by xAI/Grok for RIAs, investment firms, and hedge teams.</p>

          <div className="mh-badges">
            <span className="mh-badge mh-badge-grok">Powered by Grok</span>
            <span className="mh-badge">xAI Collection RAG</span>
          </div>

          {signedIn && isGlobalAdmin ? (
            <div className="cta-row mh-cta-row mh-cta-row--triple" role="group" aria-label="Product shortcuts">
              <Link className="cta cta-primary" href="/portfolio">
                Portfolio
              </Link>
              <Link className="cta cta-secondary" href="/xchat">
                xChat
              </Link>
              <Link className="cta cta-secondary" href="/xstrategybuilder">
                xStrategyBuilder
              </Link>
              <Link className="cta cta-secondary" href="/admin">
                Admin Console
              </Link>
            </div>
          ) : (
            <div className="mh-guest-signin" role="group" aria-label="Sign in">
              <div className="cta-row mh-cta-row">
                <Link className="cta cta-primary" href="/login?next=%2Fxchat">
                  Sign in with X
                </Link>
              </div>
              <p className="mh-login-hint">
                Free plan is pre-selected on the next step. After approval you land in <strong>xChat</strong> by
                default.
              </p>
            </div>
          )}
        </div>

        <div className="mh-right">
          <div className="mh-product-stack mh-product-stack--three">
            <ProductCard
              icon={<AtxFinanceIcon />}
              name="xFinance"
              description="Default portfolio, accounts, watchlists, and execution context for approved professionals."
            />
            <ProductCard
              icon={<XChatIcon />}
              name="xChat"
              description="xAI powered expert xFinance advisor."
            />
            <ProductCard
              icon={<XStrategyBuilderIcon />}
              name="xStrategyBuilder"
              description="AI-powered options strategy builder with Greeks, backtesting, and risk controls for licensed firms."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
