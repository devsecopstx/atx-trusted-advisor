import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";

import "../xchat/xchat.css";
import "../xcoach/xcoach.css";

const LICENSING_MODELS: { title: string; detail: string }[] = [
  {
    title: "White-label licensing",
    detail: "Firm-branded deployment with custom theme and role controls for advisors and clients."
  },
  {
    title: "API-first integration",
    detail: "Secure APIs for strategy generation, Greeks, backtesting, and execution hooks."
  },
  {
    title: "Managed hosted SaaS",
    detail: "Compliance-wrapped cloud tenancy with audit trails and enterprise support."
  }
];

const INSTITUTIONAL_REQUIREMENTS: { title: string; detail: string }[] = [
  {
    title: "Ultra-low latency and real-time data",
    detail: "Sub-second generation targets with cache-aware Grok calls and dedicated market-data feeds."
  },
  {
    title: "Encryption and compliance controls",
    detail: "SOC2/FINRA/SEC-ready posture, encrypted transit/storage, explainable strategy rationale, and tenant isolation."
  },
  {
    title: "Cybersecurity and model integrity",
    detail: "API rate controls, MFA, IP protection, and recurring validation against live trading outcomes."
  }
];

export default async function XstrategyBuilderPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/xstrategybuilder");
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xstrategybuilder" feedbackPageLabel="xStrategyBuilder" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <section className="hero-card xf-noise-overlay xc-hero" style={{ maxWidth: "860px", margin: "0 auto" }}>
          <p className="eyebrow">xStrategyBuilder</p>
          <h1 className="hero-title">Institutional options alpha, licensed your way</h1>
          <p className="hero-copy">
            No Atoms Moved. Just Gains Earned. xStrategyBuilder is now the core xFinance surface for B2B deployment
            across RIAs, investment firms, and hedge teams.
          </p>

          <div className="xc-exam-grid" role="list">
            {LICENSING_MODELS.map((item) => (
              <article key={item.title} className="xc-exam-card" role="listitem" aria-label={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <span className="xc-exam-badge">License</span>
              </article>
            ))}
          </div>

          <div className="xc-exam-grid" role="list" style={{ marginTop: "1rem" }}>
            {INSTITUTIONAL_REQUIREMENTS.map((item) => (
              <article key={item.title} className="xc-exam-card" role="listitem" aria-label={item.title}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <span className="xc-exam-badge">Required</span>
              </article>
            ))}
          </div>

          <div className="cta-row" style={{ marginTop: "1.25rem" }}>
            <Link className="cta cta-secondary" href="/xchat">
              Open xChat
            </Link>
            <Link className="cta cta-primary" href="/">
              Home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
