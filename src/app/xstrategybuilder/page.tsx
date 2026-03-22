import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { getLicensingPitchContact } from "@/lib/env";

import "../xchat/xchat.css";
import "./xstrategybuilder.css";

const PRICING_TOOLTIP = "Cheapest xFinance on earth — pay only for what you use.";

type MetricBadge = {
  label: string;
  detail: string;
};

const METRIC_BADGES: MetricBadge[] = [
  {
    label: "5–10% weekly range",
    detail:
      "Illustrative options-flow band from backtests and simulation (2026-style vol & trend regimes) — not live P/L or a guarantee."
  },
  {
    label: "20–50% annual (illustrative)",
    detail:
      "Compounded, risk-adjusted framing for desk-level deployment; hypothetical until validated on your book and compliance sign-off."
  },
  {
    label: "Austin RIA / allocator focus",
    detail:
      "Local GTM: LeafHouse (~$15B AUM), Hub (~$9B), EPIC (~$5B). Figures are public-scale references — verify independently."
  }
];

const BUILDER_STEPS = [
  "Symbol",
  "Outlook",
  "Strategy",
  "Contract",
  "Review order"
] as const;

/** Illustrative CSP/CC volatility chips — matches legacy wheel prompt pattern; not live quotes. */
const BUILDER_WATCHLIST_CHIPS: { label: string }[] = [
  { label: "RDW IV 100%" },
  { label: "LUNR IV 100%" },
  { label: "TSLA IV 100%" }
];

const LICENSING_MODELS: { title: string; detail: string }[] = [
  {
    title: "White-label desk",
    detail: "Firm-branded xStrategyBuilder: themes, roles, and advisor workflows under your mark."
  },
  {
    title: "API integration",
    detail:
      "Chain + recommendation service shape aligned with xfinance-strategy: symbol, outlook, strategyId, contractType, expiration, maxRows → option rows (bid/ask/IV) and scored leg rationale — wire to your OMS/EMS."
  },
  {
    title: "Pilot → firm-wide",
    detail: "Start with a trading pod or sleeve; expand to full-firm rollout with audit trails and governance."
  }
];

function PitchContactLine() {
  const c = getLicensingPitchContact();
  const parts: ReactNode[] = [];

  if (c.licensingEmail) {
    parts.push(
      <a key="email" href={`mailto:${c.licensingEmail}`}>
        {c.licensingEmail}
      </a>
    );
  }
  if (c.licensingXUrl) {
    const label = c.licensingXLabel?.trim() || "X";
    parts.push(
      <a key="x" href={c.licensingXUrl} rel="noopener noreferrer" target="_blank">
        {label}
      </a>
    );
  }
  if (c.companyEmail) {
    parts.push(
      <a key="company" href={`mailto:${c.companyEmail}`}>
        {c.companyEmail}
      </a>
    );
  }

  if (parts.length === 0) {
    return (
      <p className="xsb-pitch-cta-sub">
        Licensing inquiries — reach your workspace or tenant administrator, or use approved sign-in below.
      </p>
    );
  }

  return (
    <p className="xsb-pitch-cta-sub">
      Contact:{" "}
      {parts.map((node, i) => (
        <span key={i}>
          {i > 0 ? " · " : null}
          {node}
        </span>
      ))}
    </p>
  );
}

export default async function XstrategyBuilderPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/xstrategybuilder");
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xstrategybuilder" feedbackPageLabel="xStrategyBuilder" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay xc-hero xsb-pitch">
          <p className="eyebrow">xStrategyBuilder · option order builder</p>

          <div className="xsb-hero-lockup">
            <h1 className="hero-title">aTx⚡Finance — Powered by xAI</h1>
            <p className="xsb-tagline">No Atoms Moved. Just Gains Earned.</p>
          </div>

          <p className="hero-copy">
            Build defined-risk option orders with real-time chain context and P/L framing — natural-language prefill,
            guided steps, then Grok-grounded rationale. Same flow family as the xfinance-strategy builder service
            (outlooks, <code className="xsb-inline-code">STRATEGIES</code>, Yahoo chain rows, recommendation object).
          </p>

          <div
            aria-label="xStrategyBuilder product preview (non-interactive)"
            className="xsb-builder-preview"
            role="region"
          >
            <div className="xsb-builder-preview-head">
              <h2 className="xsb-builder-title">xStrategyBuilder</h2>
              <p className="xsb-builder-sub">
                Build option structures with live chain context and P/L cues — plain language first, then precise legs.
              </p>
            </div>

            <label className="xsb-builder-nl-label" htmlFor="xsb-nl-preview">
              Describe your order
            </label>
            <input
              readOnly
              className="xsb-builder-nl-input"
              id="xsb-nl-preview"
              placeholder="Describe your order in plain language"
              tabIndex={-1}
              type="text"
              value=""
            />

            <div aria-hidden className="xsb-builder-steps" role="tablist">
              {BUILDER_STEPS.map((step, i) => (
                <span
                  key={step}
                  className={i === 0 ? "xsb-builder-step xsb-builder-step--active" : "xsb-builder-step"}
                  role="tab"
                >
                  {step}
                </span>
              ))}
            </div>

            <div className="xsb-builder-panel">
              <h3 className="xsb-builder-step-heading">Step 1: Select a symbol</h3>
              <div className="xsb-builder-search">
                <span aria-hidden className="xsb-builder-search-icon">
                  ⌕
                </span>
                <span className="xsb-builder-search-placeholder">Search symbol (e.g. TSLA, AAPL)</span>
              </div>
              <div className="xsb-builder-actions">
                <span className="xsb-builder-next">Next</span>
              </div>
            </div>

            <p className="xsb-builder-watchlist-label">Top from watchlist (CSP / CC volatility)</p>
            <div className="xsb-builder-chips" role="list">
              {BUILDER_WATCHLIST_CHIPS.map((c) => (
                <span key={c.label} className="xsb-builder-chip" role="listitem">
                  {c.label}
                </span>
              ))}
            </div>

            <p className="xsb-builder-contract-note">
              Session tool contract: <code className="xsb-inline-code">symbol</code>, optional{" "}
              <code className="xsb-inline-code">outlook</code>, <code className="xsb-inline-code">strategyId</code>,{" "}
              <code className="xsb-inline-code">contractType</code>, <code className="xsb-inline-code">expiration</code>
              , <code className="xsb-inline-code">maxRows</code> → symbol snapshot, option chain rows (call/put per
              strike), and a recommendation block (action, strikes, breakeven, rationale) — see xfinance-strategy{" "}
              <code className="xsb-inline-code">xstrategy-builder-service</code>.
            </p>

            <p className="xsb-occ-foot">
              Options involve risk and are not suitable for all investors. Review OCC disclosures before trading.
            </p>
          </div>

          <div className="xsb-badges" role="list">
            {METRIC_BADGES.map((b) => (
              <article key={b.label} className="xsb-metric-badge" role="listitem">
                <div className="xsb-metric-badge-top">
                  <span className="xsb-metric-arrow" aria-hidden>
                    ↑
                  </span>
                  {b.label}
                </div>
                <p className="xsb-metric-detail">{b.detail}</p>
              </article>
            ))}
          </div>

          <p className="xsb-disclaimer">
            Hypothetical and backtested results have inherent limitations; past or simulated performance does not
            guarantee future results. Not an offer or solicitation — diligence and compliance review required.
          </p>

          <div className="xsb-value-card">
            <h2>Value proposition</h2>
            <ul className="xsb-value-list">
              <li>
                <strong>White-label or API</strong>
                <span>Ship under your brand or wire our engines into OMS/EMS and research stacks.</span>
              </li>
              <li>
                <strong>Real-time Greeks &amp; backtests</strong>
                <span>Scenario analysis, execution hooks, and Grok-grounded rationale for defined-risk options income.</span>
              </li>
              <li>
                <strong>Compliance-forward</strong>
                <span>SOC 2–aligned roadmap, tenant isolation, immutable audit trails for approvals and overrides.</span>
              </li>
              <li>
                <strong>Pilot, then scale</strong>
                <span>Pod-level pilot with measurable desk KPIs; expand to full-firm deployment when ready.</span>
              </li>
            </ul>
          </div>

          <div className="xc-exam-grid" role="list" style={{ marginTop: "1rem" }}>
            {LICENSING_MODELS.map((item) => (
              <article key={item.title} className="xc-exam-card" role="listitem" aria-label={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <span className="xc-exam-badge">License</span>
              </article>
            ))}
          </div>

          <div className="xsb-pitch-cta">
            <p className="xsb-pitch-cta-lead">
              Boost your traders&apos; edge — license aTx⚡Finance xStrategyBuilder today. Demo in 15 minutes.
            </p>
            <PitchContactLine />
            <p className="xsb-pitch-cta-sub xsb-pitch-cta-sub--tight">
              <Link href="/">aTx⚡Finance</Link>
              {" · "}
              <Link href="/login?next=/xstrategybuilder">Sign in with X</Link> (approved access)
            </p>
            <p className="xsb-pricing-hint">
              Retail / pay-per-use from <abbr title={PRICING_TOOLTIP}>$2/hr</abbr> — enterprise licensing quoted
              separately.
            </p>
          </div>

          <div className="cta-row" style={{ marginTop: "1.25rem" }}>
            <Link className="cta cta-primary" href="/xstrategybuilder/strategy-options">
              Open strategy options chain
            </Link>
            <Link className="cta cta-secondary" href="/xchat">
              Open xChat
            </Link>
            <Link className="cta cta-secondary" href="/">
              Home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
