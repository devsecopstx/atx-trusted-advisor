import { XFinanceLogo } from "./xfinance-logo";

function RisingChart() {
  return (
    <svg
      aria-hidden="true"
      className="mh-chart-icon"
      fill="none"
      viewBox="0 0 80 56"
    >
      <path
        d="M4 48 L18 36 L30 40 L44 22 L56 26 L68 10 L76 4"
        stroke="var(--xf-gain-green)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="M4 48 L18 36 L30 40 L44 22 L56 26 L68 10 L76 4 L76 56 L4 56Z"
        fill="url(#chartGrad)"
        opacity="0.15"
      />
      <defs>
        <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--xf-gain-green)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GainArrow() {
  return (
    <svg
      aria-hidden="true"
      className="mh-gain-arrow"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 19V6M12 6l5 5M12 6L7 11"
        stroke="var(--xf-gain-green)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DollarSign() {
  return (
    <span aria-hidden="true" className="mh-dollar">$</span>
  );
}

function PhoneMockup() {
  return (
    <div className="mh-phone">
      <div className="mh-phone-screen">
        <div className="mh-phone-header">
          <span className="mh-phone-dot" />
          <span className="mh-phone-pill" />
          <span className="mh-phone-dot" />
        </div>
        <div className="mh-phone-portfolio">
          <span className="mh-phone-label">Portfolio</span>
          <span className="mh-phone-value">
            <DollarSign />12,847.32
          </span>
          <span className="mh-phone-gain">
            <GainArrow />
            +4.2%
          </span>
        </div>
        <RisingChart />
        <div className="mh-phone-actions">
          <span className="mh-phone-btn mh-phone-btn-buy">Buy</span>
          <span className="mh-phone-btn mh-phone-btn-sell">Sell</span>
        </div>
      </div>
    </div>
  );
}

function TraderSilhouette() {
  return (
    <svg
      aria-hidden="true"
      className="mh-trader"
      fill="none"
      viewBox="0 0 48 72"
    >
      <circle cx="24" cy="10" fill="rgba(255,255,255,0.08)" r="8" />
      <path
        d="M12 72V42a12 12 0 0 1 24 0v30"
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.5"
      />
      <path
        d="M6 52l6-10M42 52l-6-10"
        stroke="rgba(255,255,255,0.1)"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
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
            Retail investing &amp; trading for everyday people
          </p>

          <h1 className="mh-tagline">
            No Atoms Moved.{" "}
            <br />
            Just <span className="mh-tagline-glow">Gains</span> Earned.
          </h1>

          <p className="mh-sub">
            Smart, accessible finance built for independent traders.
            No suits. No whales. Just you and the market.
          </p>

          <div className="mh-badges">
            <span className="mh-badge">
              <DollarSign /> Zero Commission
            </span>
            <span className="mh-badge">
              <GainArrow /> Real-time Charts
            </span>
            <span className="mh-badge mh-badge-grok">
              Powered by Grok
            </span>
          </div>

          <div className="mh-cta-row">
            <a className="mh-cta-primary" href="/login">
              Start Trading
            </a>
            <a className="mh-cta-secondary" href="/admin">
              Admin Console
            </a>
          </div>
        </div>

        <div className="mh-right">
          <PhoneMockup />
          <TraderSilhouette />
        </div>
      </div>
    </section>
  );
}
