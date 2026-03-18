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

function XIcon() {
  return (
    <svg className="mh-oauth-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="mh-oauth-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="mh-oauth-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

type OAuthButtonProps = {
  provider: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

function OAuthButton({ provider, href, icon, disabled }: OAuthButtonProps) {
  const cls = `mh-oauth-btn${disabled ? " mh-oauth-btn-disabled" : ""}`;
  if (disabled) {
    return (
      <span className={cls} aria-disabled="true">
        {icon} {provider} <small>(coming soon)</small>
      </span>
    );
  }
  return (
    <a className={cls} href={href}>
      {icon} Sign in with {provider}
    </a>
  );
}

export function MarketingHero() {
  return (
    <section className="mh-hero">
      <div className="mh-grid-lines" aria-hidden="true" />
      <div className="mh-circuit-dots" aria-hidden="true" />

      <div className="mh-content">
        <div className="mh-left">
          <AtxFinanceLogo size="md" showSubtitle />
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
            Start free — upgrade when you need more.
          </p>

          <div className="mh-badges">
            <span className="mh-badge mh-badge-grok">
              Powered by Grok
            </span>
            <span className="mh-badge">
              xAI Collection RAG
            </span>
          </div>

          <div className="mh-cta-row">
            <a className="mh-cta-primary" href="/login">
              atxFinance Advisory
            </a>
            <a className="mh-cta-secondary" href="/admin">
              Admin Console
            </a>
          </div>
        </div>

        <div className="mh-right">
          <div className="mh-product-stack">
            <ProductCard
              icon={<AtxFinanceIcon />}
              name="atxFinance"
              description="Portfolio management, watchlists, accounts, and strategy execution for finance professionals."
            />
            <ProductCard
              icon={<XChatIcon />}
              name="xChat"
              description="AI advisor with persona-driven tools, RAG context, and real-time atxFinance data access."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
