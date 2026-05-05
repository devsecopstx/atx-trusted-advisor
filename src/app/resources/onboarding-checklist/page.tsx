import type { Metadata } from "next";
import Link from "next/link";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { XchatGuestHeader } from "@/app/ui/xchat-guest-header";
import { XchatGuestReadonlyShell } from "@/app/xchat/ui/xchat-guest-readonly-shell";
import { getSessionUser } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { canUserLogin } from "@/modules/identity/authorization";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Onboarding Checklist | Resources",
  description:
    "HNWI onboarding order: portfolio foundation through final StrategyJob validation — watchlist, risk outlook, broker parity, xChat/xOptions, run-now test — educational workflow only.",
  alternates: {
    canonical: "/resources/onboarding-checklist"
  },
  openGraph: {
    title: "Onboarding Checklist | Resources",
    description:
      "HNWI onboarding order: portfolio foundation through final StrategyJob validation — watchlist, risk outlook, broker parity, xChat/xOptions, run-now test — educational workflow only.",
    type: "article"
  }
};

const NAV_STEPS: { id: string; label: string }[] = [
  { id: "portfolio-foundation", label: "1 · Portfolio" },
  { id: "watchlist-curation", label: "2 · Watchlist" },
  { id: "risk-outlook", label: "3 · Risk & outlook" },
  { id: "broker-parity", label: "4 · Broker parity" },
  { id: "personalize", label: "5 · xChat & xOptions" },
  { id: "final-validation", label: "6 · Validate" },
  { id: "expected-outcome", label: "Outcome" }
];

export default async function ResourcesOnboardingChecklistPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Onboarding Checklist",
        railVariant: "workspace-product"
      })
    : null;

  const article = (
    <article className="resources-doc-shell" aria-label="Onboarding checklist">
      <header className="resources-doc-hero">
        <p className="resources-doc-hero__eyebrow">Resources · Platform overview</p>
        <h1 className="resources-doc-hero__title">Onboarding checklist</h1>
        <p className="resources-doc-hero__copy resources-doc-hero__copy--full">
          Complete these in order and you move from generic suggestions toward institution-grade, context-aware
          recommendations quickly.{" "}
          <span className="resources-about-pillars-legal-note">Educational workflow only — not individualized advice.</span>
        </p>
      </header>

      <nav className="resources-doc-nav" aria-label="Checklist sections">
        {NAV_STEPS.map((s) => (
          <a key={s.id} className="resources-doc-nav__chip" href={`#${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <section className="resources-doc-section" id="portfolio-foundation">
        <h2>1. Portfolio foundation (non-negotiable)</h2>
        <p className="resources-doc-section__desc">
          Most recommendation accuracy comes from the book the product can see: portfolios, accounts, positions, and
          cash.
        </p>
        <ul className="resources-about-list">
          <li>
            <strong>Create or designate primary portfolio(s).</strong> You can run multiple books (for example Core
            Income, Growth Alpha, taxable vs IRA). The workspace tracks each independently with lot-level cost basis.
          </li>
          <li>
            <strong>Import or connect every account.</strong>{" "}
            <Link href="/import-activity">Broker CSV upload</Link> (Merrill, Fidelity, etc.) via{" "}
            <Link href="/import-activity">/import-activity</Link> — auto-mapping builds consolidated holdings with{" "}
            <strong>Avg cost</strong> vs <strong>Last</strong>.
          </li>
          <li>
            <strong>IBKR Client Portal (recommended for a live execution path):</strong>{" "}
            <Link href="/account/integrations/ibkr">Connect IBKR</Link> — consent plus sealed session surfaces positions,
            cash, and margin for entitled accounts.
          </li>
          <li>
            <strong>Verify consolidated holdings</strong> in{" "}
            <Link href="/portfolio">Portfolio</Link> → Edit Account: cash balances, open positions, average costs, and
            day P&amp;L.
          </li>
        </ul>
        <p className="resources-doc-section__desc resources-doc-section__desc--closing">
          Covered calls, cash-secured puts, collars, and wheel-style workflows only line up with your capital and
          underlying exposure when the engine sees real positions. Without that, even xAI stays theoretical.
        </p>
      </section>

      <section className="resources-doc-section" id="watchlist-curation">
        <h2>2. Curate a high-conviction watchlist</h2>
        <p className="resources-doc-section__desc">
          Watchlist drives symbol-scoped discovery and feeds downstream scanners and xOptions context.
        </p>
        <ul className="resources-about-list">
          <li>
            Open <Link href="/watchlist">/watchlist</Link> and add: all core holdings; 10–20 high-conviction names you
            trade or want flow on; names tied to your outlook (earnings, event-driven ideas, etc.).
          </li>
          <li>
            Enable <Link href="/portfolio/alerts">price alerts</Link> on key levels — scheduled scanners and desk alerts
            surface opportunities when configured.
          </li>
          <li>
            The workspace rail compact watchlist and &quot;hot&quot; IV/OI rows feed{" "}
            <Link href="/xoptions">xOptions</Link> Step 1 (Find Options) and multi-agent workspace context.
          </li>
        </ul>
      </section>

      <section className="resources-doc-section" id="risk-outlook">
        <h2>3. Risk profile and investment outlook</h2>
        <p className="resources-doc-section__desc">
          Explicit posture maps into conservative / balanced / aggressive scoring paths and strategy jobs.
        </p>
        <ul className="resources-about-list">
          <li>
            In <Link href="/xchat">xChat</Link> (or your initial NL prompt), state: <strong>risk tolerance</strong>{" "}
            (conservative income / defined-risk, balanced theta + mild delta, aggressive directional or vol-selling —
            only if your role and broker approvals allow); <strong>market outlook</strong> (bullish, range-bound,
            bearish, event-driven, vol crush, etc.).
          </li>
          <li>
            Add <strong>time horizon</strong>, allocation rules (e.g. max notional per strategy, preferred DTE bands), tax
            and liquidity constraints where they matter.
          </li>
          <li>
            Seeded <strong>options strategy preferences</strong> (Mongo catalog aligned with disk xPersonas / coreskills)
            plus your chosen xChat persona anchor those signals into strategy scoring and{" "}
            <strong>StrategyJob</strong>-class flows — preflight → slot collection → synthesize becomes surgical instead
            of generic when workspace data is complete.
          </li>
        </ul>
      </section>

      <section className="resources-doc-section" id="broker-parity">
        <h2>4. Broker and market-data parity</h2>
        <p className="resources-doc-section__desc">
          Keep custodian identity and imports aligned so sync and desk views match the broker of record.
        </p>
        <ul className="resources-about-list">
          <li>
            Update the broker / external account reference (<strong>ext account id</strong> and related desk fields) so
            each portfolio account syncs to the right custodian row.
          </li>
          <li>
            Re-run <Link href="/import-activity">broker import</Link> when you need the latest CSV-backed activity; use
            consolidated holdings and import previews to reconcile vs the broker&apos;s export.
          </li>
          <li>
            Where IBKR is linked, refresh consent/session if snapshots look stale so positions and cash match Client
            Portal.
          </li>
        </ul>
      </section>

      <section className="resources-doc-section" id="personalize">
        <h2>5. Personalize xChat and xOptions</h2>
        <p className="resources-doc-section__desc">
          Continuity and product-specific personas tighten recommendations across sessions.
        </p>
        <ul className="resources-about-list">
          <li>
            In xChat preferences, opt in to <strong>conversation history</strong> when available — turns persist in{" "}
            <strong>Mongo</strong> <code>xchat_logs</code> with a <strong>60-day</strong> TTL pattern on stored turns
            (product-enforced rolling window).
          </li>
          <li>
            Use the <strong>options-strategy</strong> persona (or the hardcore strategy path) for structure-heavy asks so
            routing uses RAG + <strong>OptionsStrategyEngine</strong> scoring where configured.
          </li>
          <li>
            On <Link href="/xoptions">/xoptions</Link>, run at least one full stepped builder flow — Step 1 bootstrap
            pulls portfolio + watchlist context and seeds context for later jobs.
          </li>
        </ul>
      </section>

      <section className="resources-doc-section" id="final-validation">
        <h2>6. Final validation and “Run now” test</h2>
        <p className="resources-doc-section__desc">
          Prove the stack end-to-end: scheduler or strategy job, then inspect outputs like you would a desk review.
        </p>
        <ul className="resources-about-list">
          <li>
            <strong>Trigger execution:</strong> Have an operator run a <strong>manual scheduler tick</strong> where your
            tenant uses scheduled jobs (<Link href="/admin/tasks">Admin → Tasks</Link> for <strong>global_admin</strong>;
            workspace automations at <Link href="/workspace/tasks">/workspace/tasks</Link> when configured). Or start a
            new <strong>StrategyJob</strong> from <Link href="/xchat">xChat</Link> — for example:{" "}
            <em>
              Run full options strategy scan on my Core Income portfolio using balanced outlook with 2-week horizon.
            </em>
          </li>
          <li>
            <strong>Review outputs:</strong> strategy cards, payoff charts (<strong>Apex</strong> in-product), Greeks, and
            risk / outlook tags — confirm they match your book and the posture you stated in step 3.
          </li>
          <li>
            <strong>If something looks off:</strong> the <strong>admin audit trail</strong> (
            <Link href="/admin/audit">Admin → Audit</Link> when you have access) plus{" "}
            <strong>tenant xChat debug logging</strong> (Admin → Tenant workspace, when enabled) make iteration and
            refinement straightforward for operators — no guesswork.
          </li>
        </ul>
      </section>

      <section className="resources-doc-section" id="expected-outcome">
        <h2>Expected outcome once complete</h2>
        <p className="resources-doc-section__desc">
          With the steps above done, you should see production-grade, xAI-augmented recommendations that:
        </p>
        <ul className="resources-about-list">
          <li>
            <strong>Respect your actual portfolio construction and cash</strong> — grounded on consolidated holdings,
            accounts, and imports you verified.
          </li>
          <li>
            <strong>Align with your chosen risk bucket</strong> — conservative, balanced, or aggressive — as you
            expressed in xChat and scoring prefs.
          </li>
          <li>
            <strong>Leverage the full stack</strong> — RAG-linked <strong>options coreskills</strong> library plus{" "}
            <strong>OptionsStrategyEngine</strong> scoring where the product routes your asks.
          </li>
        </ul>
        <p className="resources-doc-section__desc resources-doc-section__desc--closing">
          Outcomes still depend on market data freshness, persona/RAG configuration, and plan limits — treat this as the
          standard setup bar, not a performance guarantee.
        </p>
      </section>

      <p className="resources-guide__disclaimer">
        Options involve risk and may not be suitable for all investors. This checklist describes product workflows only;
        it is not an offer or recommendation to buy or sell any security.
      </p>
    </article>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader
          current="xchat"
          feedbackPageLabel="Resources · Onboarding Checklist"
          session={session}
        />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body" style={{ padding: "1rem" }}>
        {approved && session ? (
          <AppUserCollapsibleRailLayout rail={workspaceProductRail} railChrome="workspace-product">
            {article}
            <GlobalFooter />
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref} rail={workspaceProductRail ?? undefined}>
            {article}
            <GlobalFooter />
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
