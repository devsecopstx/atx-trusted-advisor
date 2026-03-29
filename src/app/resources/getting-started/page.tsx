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
import "./resources-getting-started.css";

export const dynamic = "force-dynamic";

const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "daily-usage", label: "Daily Usage" },
  { id: "strategies", label: "Strategies" },
  { id: "options-basics", label: "Options Basics" },
  { id: "risk-disclosures", label: "Risk & Disclosures" }
];

const RETURN_TARGETS: { annual: string; biWeekly: string; weekly: string }[] = [
  { annual: "5%", biWeekly: "0.19%", weekly: "0.10%" },
  { annual: "8%", biWeekly: "0.31%", weekly: "0.15%" },
  { annual: "10%", biWeekly: "0.38%", weekly: "0.19%" },
  { annual: "15%", biWeekly: "0.58%", weekly: "0.29%" }
];

export default async function ResourcesGettingStartedPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="Resources getting started guide">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Getting Started</p>
          <h1 className="resources-doc-hero__title">Guide to investing with options</h1>
          <p className="resources-doc-hero__copy">
            Migrated from the legacy docs with focus on practical options workflows: onboarding, day-to-day usage,
            strategy patterns, and risk controls. Automation/tasks/config sections are intentionally excluded.
          </p>
        </header>

        <nav className="resources-doc-nav" aria-label="Guide sections">
          {NAV_SECTIONS.map((section) => (
            <a key={section.id} className="resources-doc-nav__chip" href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>

        <section className="resources-doc-section" id="getting-started">
          <h2>Getting started</h2>
          <p className="resources-doc-section__desc">
            Set up your default portfolio and account context, then run through one symbol-first strategy cycle in
            xStrategyBuilder before placing any live orders.
          </p>
          <div className="resources-doc-grid">
            <div className="resources-doc-card">
              <h3>Accounts and holdings</h3>
              <p>
                Add brokerage accounts, verify positions (stock, options, cash), and confirm your default account
                has risk/outlook values so strategy scoring can use complete context.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>First execution loop</h3>
              <p>
                Start with one underlying, define outlook, pick a strategy, then review expiration + strike +
                breakeven + payoff before making execution decisions.
              </p>
            </div>
          </div>
        </section>

        <section className="resources-doc-section" id="daily-usage">
          <h2>Daily usage</h2>
          <p className="resources-doc-section__desc">
            Core app surfaces to monitor positions and evaluate new options opportunities.
          </p>
          <div className="resources-doc-grid">
            <div className="resources-doc-card">
              <h3>Portfolio and watchlist</h3>
              <p>
                Use <Link href="/portfolio">Portfolio</Link> and <Link href="/watchlist">Watchlist</Link> to track
                symbol context, desk fields, and quote drift before deciding on new option structures.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>xStrategyBuilder workflow</h3>
              <p>
                Use <Link href="/xstrategybuilder">xStrategyBuilder</Link> for symbol selection, strategy fit, live
                payoff simulation, and contract exploration through the strategy options console.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>xChat for rationale checks</h3>
              <p>
                Use <Link href="/xchat">xChat</Link> to stress test assumptions, scenario risk, and alternative
                structures. Keep prompts explicit about time horizon and assignment tolerance.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>Secret Sauce (how responses are built)</h3>
              <p>
                Read <Link href="/resources/secret-sauce">Secret Sauce</Link> for the end-to-end flow: workspace
                context, SE scoring factors, collections search, web/x-search, and tool-loop synthesis.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>Alerts and reviews</h3>
              <p>
                Treat scanner recommendations as decision support, not auto-execution. Re-check liquidity, spreads,
                and macro volatility before acting.
              </p>
            </div>
          </div>
        </section>

        <section className="resources-doc-section" id="strategies">
          <h2>Strategies and scanners</h2>
          <p className="resources-doc-section__desc">
            A practical summary of legacy strategy docs oriented around income + defined risk.
          </p>
          <div className="resources-doc-grid">
            <div className="resources-doc-card">
              <h3>Wheel strategy</h3>
              <p>
                Sell OTM cash-secured puts for income and potential discount entry. If assigned, sell OTM covered
                calls on acquired shares. If called away, rotate back to puts.
              </p>
              <p>
                Deep dive: <Link href="/resources/building-wheel">Building Wheel guide</Link>.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>Covered calls</h3>
              <p>
                Use weekly/bi-weekly expirations and strike distance based on assignment appetite. Bi-weekly often
                balances premium capture with lower management overhead.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>Protective structures</h3>
              <p>
                For downside control, evaluate protective puts or put spreads when volatility and event risk rise
                above your desk threshold.
              </p>
            </div>
            <div className="resources-doc-card">
              <h3>Scanner interpretation</h3>
              <p>
                Scanner outputs are ranked suggestions. Validate with live chain quality (OI/volume/spread) and
                portfolio constraints before executing.
              </p>
            </div>
          </div>
        </section>

        <section className="resources-doc-section" id="options-basics">
          <h2>Options basics for execution</h2>
          <p className="resources-doc-section__desc">
            Keep the process systematic: entry context, strike distance, premium target, and exit rules.
          </p>
          <ul className="resources-doc-list">
            <li>
              <strong>80% rule:</strong> for sold premium, many desks buy back early around 80% captured premium to
              reduce tail-risk exposure.
            </li>
            <li>
              <strong>Strike discipline:</strong> choose strike distance from current spot and expected move, not
              solely by premium.
            </li>
            <li>
              <strong>Expiration selection:</strong> shorter DTE increases gamma risk; longer DTE increases capital
              lock-up. Match tenor to the thesis.
            </li>
            <li>
              <strong>Position sizing:</strong> cap notional risk per idea and enforce portfolio-level downside
              limits.
            </li>
          </ul>

          <table className="resources-doc-table" aria-label="Illustrative yield targets">
            <thead>
              <tr>
                <th>Target annual</th>
                <th>Bi-weekly per trade</th>
                <th>Weekly per trade</th>
              </tr>
            </thead>
            <tbody>
              {RETURN_TARGETS.map((row) => (
                <tr key={row.annual}>
                  <td>{row.annual}</td>
                  <td>{row.biWeekly}</td>
                  <td>{row.weekly}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="resources-doc-section" id="risk-disclosures">
          <h2>Risk and disclosures</h2>
          <p className="resources-doc-section__desc">
            Options can lose substantial value, including full premium paid for long options and significant losses
            in uncovered or poorly hedged structures.
          </p>
          <ul className="resources-doc-list">
            <li>Use only risk capital and define max-loss before entry.</li>
            <li>Account for assignment/exercise paths and settlement obligations.</li>
            <li>Check spreads and liquidity; theoretical payoff can diverge from executable outcomes.</li>
            <li>
              Review OCC disclosures and your broker&apos;s options agreement before trading.{" "}
              <span className="xf-disclaimer-emphasis">Not financial advice.</span>
            </li>
          </ul>
          <p className="resources-doc-footnote">
            Exclusions from legacy migration: automation workflows, scheduled task operations, and environment or
            configuration instructions.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Getting Started" session={session} />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body" style={{ padding: "1rem" }}>
        {approved && session ? (
          <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
            {shellContent}
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref}>
            {shellContent}
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
