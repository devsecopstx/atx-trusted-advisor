import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

export const dynamic = "force-dynamic";

const RETURN_TABLE: { annual: string; biWeekly: string; weekly: string }[] = [
  { annual: "5%", biWeekly: "0.19%", weekly: "0.10%" },
  { annual: "8%", biWeekly: "0.31%", weekly: "0.15%" },
  { annual: "10%", biWeekly: "0.38%", weekly: "0.19%" },
  { annual: "15%", biWeekly: "0.58%", weekly: "0.29%" }
];

const WHEEL_STEPS: string[] = [
  "Start with cash or existing shares.",
  "Sell out-of-the-money cash-secured put (commonly 5-10% below spot).",
  "If put expires worthless, keep premium and repeat.",
  "If assigned, acquire shares at strike and lower net basis by premium collected.",
  "Sell out-of-the-money covered call (commonly 5-10% above spot).",
  "If call expires worthless, keep premium and continue covered call cadence.",
  "If called away, realize share gain + premium and rotate back to cash-secured puts."
];

export default async function ResourcesBuildingWheelPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Building Wheel" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
          <article className="resources-doc-shell" aria-label="Building wheel strategy guide">
            <header className="resources-doc-hero">
              <p className="resources-doc-hero__eyebrow">Resources · Building Wheel</p>
              <h1 className="resources-doc-hero__title">Wheel strategy playbook</h1>
              <p className="resources-doc-hero__copy">
               This guide focuses on wheel execution, covered call cadence, return framing, and risk controls.
              </p>
            </header>

            <section className="resources-doc-section" id="overview">
              <h2>Overview</h2>
              <p className="resources-doc-section__desc">
                The wheel cycles between short cash-secured puts and short covered calls. It aims to collect recurring
                premium while controlling entry/exit through strike selection and assignment rules.
              </p>
              <ul className="resources-doc-list">
                {WHEEL_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </section>

            <section className="resources-doc-section" id="covered-calls">
              <h2>Covered call cadence</h2>
              <p className="resources-doc-section__desc">
                Weekly and bi-weekly cadences both work. Weekly often needs more active management; bi-weekly typically
                balances premium and operational load.
              </p>
              <div className="resources-doc-grid">
                <article className="resources-doc-card">
                  <h3>Weekly</h3>
                  <p>5-7 days, usually tighter strike distance, faster premium compounding, higher management load.</p>
                </article>
                <article className="resources-doc-card">
                  <h3>Bi-weekly</h3>
                  <p>10-14 days, generally larger per-trade credit, less frequent adjustments and rolls.</p>
                </article>
              </div>
            </section>

            <section className="resources-doc-section" id="return-targets">
              <h2>Illustrative premium targets</h2>
              <p className="resources-doc-section__desc">
                These are framing benchmarks, not guaranteed outcomes. Realized returns depend on
                assignment, volatility regimes, slippage, and risk controls.
              </p>
              <table className="resources-doc-table" aria-label="Illustrative premium target table">
                <thead>
                  <tr>
                    <th>Target annual</th>
                    <th>Bi-weekly per trade</th>
                    <th>Weekly per trade</th>
                  </tr>
                </thead>
                <tbody>
                  {RETURN_TABLE.map((row) => (
                    <tr key={row.annual}>
                      <td>{row.annual}</td>
                      <td>{row.biWeekly}</td>
                      <td>{row.weekly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="resources-doc-footnote">
                Premium capture heuristic: many desks close short options after ~80% credit capture rather than waiting to expiration.
              </p>
            </section>

            <section className="resources-doc-section" id="risk-controls">
              <h2>Risk controls</h2>
              <ul className="resources-doc-list">
                <li>Define max allocation per underlying and per expiration cycle.</li>
                <li>Predefine roll/close rules before entry (profit target, max adverse move, DTE checkpoints).</li>
                <li>Track assignment risk and ensure sufficient cash/shares for obligations.</li>
                <li>Prefer liquid chains with tight spreads; avoid forcing entries in thin markets.</li>
                <li>
                  Keep macro/event risk in view; reduce size into earnings or known volatility catalysts.{" "}
                  <span className="xf-disclaimer-emphasis">Not financial advice.</span>
                </li>
              </ul>
            </section>

            <section className="resources-doc-section" id="where-to-run">
              <h2>Where to run this in xFinance</h2>
              <div className="resources-doc-grid">
                <article className="resources-doc-card">
                  <h3>xStrategyBuilder</h3>
                  <p>
                    Build and compare wheel legs, inspect payoff shape, and test scenario changes before execution.
                    Start at <Link href="/xstrategybuilder">xStrategyBuilder</Link>.
                  </p>
                </article>
                <article className="resources-doc-card">
                  <h3>Watchlist and Portfolio</h3>
                  <p>
                    Track context and desk fields in <Link href="/watchlist">Watchlist</Link>, then confirm book-level
                    exposure and account readiness in <Link href="/portfolio">Portfolio</Link>.
                  </p>
                </article>
              </div>
            </section>
          </article>
          <GlobalFooter />
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
