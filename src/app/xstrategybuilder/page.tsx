import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BackIcon, RunIcon } from "@/app/admin/ui/crud-icons";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { getLicensingPitchContact } from "@/lib/env";

import { loadXsbInitialWorkspace } from "./load-initial-workspace";
import { XstrategybuilderPublicPreview } from "./ui/xstrategybuilder-public-preview";

import "../xchat/xchat.css";
import "./xstrategybuilder.css";

export const dynamic = "force-dynamic";

const PRICING_TOOLTIP = "Cheapest atx Trusted Advisor workspace on earth — pay only for what you use.";

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
    label: "Austin allocator / trusted-family focus",
    detail:
      "Local GTM: LeafHouse (~$15B AUM), Hub (~$9B), EPIC (~$5B). Figures are public-scale references — verify independently."
  }
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
    redirect("/xchat");
  }

  const initialWorkspace = await loadXsbInitialWorkspace(session);

  return (
    <div className="xchat-shell xsb-iconized">
      <AppUserApprovedHeader current="xstrategybuilder" feedbackPageLabel="xStrategyBuilder" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay xc-hero xsb-pitch">
          <p className="eyebrow">xStrategyBuilder · option order builder</p>

          <div className="xsb-hero-lockup">
            <h1 className="hero-title xsb-hero-title">aTx⚡Finance — Powered by xAI</h1>
            <p className="xsb-tagline xsb-tagline--hero">No Atoms Moved. Just Gains Earned.</p>
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

          <p className="xsb-hero-subcopy">
            Build defined-risk option orders with real-time chain context and P/L framing — natural-language prefill,
            guided steps, then Grok-grounded rationale. Same flow family as the xfinance-strategy builder service
            (outlooks, <code className="xsb-inline-code">STRATEGIES</code>, Yahoo chain rows, recommendation object).
          </p>

          <XstrategybuilderPublicPreview initialWorkspace={initialWorkspace} />

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
              <Link href="/api/auth/x/login?next=%2Fxstrategybuilder">Sign in with X</Link> (approved access)
            </p>
            <p className="xsb-pricing-hint">
              Retail / pay-per-use from <abbr title={PRICING_TOOLTIP}>$2/hr</abbr> — enterprise licensing quoted
              separately.
            </p>
          </div>

          <div className="cta-row" style={{ marginTop: "1.25rem" }}>
            <Link
              aria-label="Open strategy options chain"
              className="cta cta-primary"
              href="/xstrategybuilder/strategy-options"
              title="Open strategy options chain"
            >
              <RunIcon className="crud-icon" />
              Open strategy options chain
            </Link>
            <Link aria-label="Open xChat" className="cta cta-secondary" href="/xchat" title="Open xChat">
              <RunIcon className="crud-icon" />
              Open xChat
            </Link>
            <Link aria-label="Home" className="cta cta-secondary" href="/" title="Home">
              <BackIcon className="crud-icon" />
              Home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
