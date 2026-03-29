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

const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: "workspace-context", label: "Workspace Context" },
  { id: "search-blend", label: "Search Blend" },
  { id: "tool-loop", label: "Tool Loop" },
  { id: "strategy-engine", label: "Strategy Engine" },
  { id: "best-prompts", label: "Best Prompting" }
];

export default async function ResourcesSecretSaucePage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Secret Sauce" session={session} />

      <div className="xchat-body" style={{ padding: "1rem" }}>
        <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
          <article className="resources-doc-shell" aria-label="xFinance secret sauce guide">
            <header className="resources-doc-hero">
              <p className="resources-doc-hero__eyebrow">Resources · Secret Sauce</p>
              <h1 className="resources-doc-hero__title">How xChat gives higher-quality answers</h1>
              <p className="resources-doc-hero__copy">
                xChat performs best when it combines your workspace context (portfolio + account settings), scoring
                factors, and mixed retrieval (collections + web/x-search + live market checks) in one tool loop. This
                page explains the mechanics in plain language.
              </p>
            </header>

            <nav className="resources-doc-nav" aria-label="Secret sauce sections">
              {NAV_SECTIONS.map((section) => (
                <a key={section.id} className="resources-doc-nav__chip" href={`#${section.id}`}>
                  {section.label}
                </a>
              ))}
            </nav>

            <section className="resources-doc-section" id="workspace-context">
              <h2>1) Workspace context: portfolio, outlook, risk, scoring factors</h2>
              <p className="resources-doc-section__desc">
                xChat is not answering in a vacuum. It uses your workspace state so responses match your book and
                constraints, not generic internet commentary.
              </p>
              <ul className="resources-doc-list">
                <li>
                  <strong>Portfolio + account context:</strong> default portfolio/account establish where positions and
                  cash risk sit.
                </li>
                <li>
                  <strong>Outlook + risk profile:</strong> strategy direction and aggressiveness are filtered to match
                  your desk stance.
                </li>
                <li>
                  <strong>SE Scoring Factors:</strong> scoring weights prioritize what your workspace values (for
                  example liquidity, vol profile, income-fit).
                </li>
              </ul>
            </section>

            <section className="resources-doc-section" id="search-blend">
              <h2>2) Search blend: collections + xChat + web + live x-search</h2>
              <p className="resources-doc-section__desc">
                xChat combines internal and external sources to reduce blind spots and stale reasoning.
              </p>
              <div className="resources-doc-grid">
                <article className="resources-doc-card">
                  <h3>Collections search (your docs)</h3>
                  <p>
                    Pulls from configured workspace collections first, so policy notes, desk memos, and internal
                    standards are grounded in your own source material.
                  </p>
                </article>
                <article className="resources-doc-card">
                  <h3>Web/x-search (external context)</h3>
                  <p>
                    Adds current public context when needed (news flow, market narrative, recent developments), instead
                    of relying only on local docs.
                  </p>
                </article>
                <article className="resources-doc-card">
                  <h3>Live market checks</h3>
                  <p>
                    For symbols/chains, xChat can route to live quote or market tools so strike/expiry reasoning uses
                    fresher numbers.
                  </p>
                </article>
                <article className="resources-doc-card">
                  <h3>Single answer synthesis</h3>
                  <p>
                    The model merges these signals into one recommendation path, with rationale aligned to your
                    workspace constraints.
                  </p>
                </article>
              </div>
            </section>

            <section className="resources-doc-section" id="tool-loop">
              <h2>3) Tool loop (brief)</h2>
              <p className="resources-doc-section__desc">
                xChat runs an iterative loop: think {"->"} call tools {"->"} absorb results {"->"} continue until it
                can answer with enough confidence.
              </p>
              <ol className="resources-doc-list">
                <li>User prompt enters with persona + workspace context.</li>
                <li>Model decides which tools to call (collections, web/x-search, market/tooling).</li>
                <li>Tool outputs feed back into the same response run.</li>
                <li>Loop repeats until completion and then returns a final response.</li>
              </ol>
            </section>

            <section className="resources-doc-section" id="strategy-engine">
              <h2>4) xStrategyBuilder + engine concepts</h2>
              <p className="resources-doc-section__desc">
                xStrategyBuilder and the strategy engine apply the same context discipline in a more explicit pipeline.
              </p>
              <ul className="resources-doc-list">
                <li>
                  <strong>User context stage:</strong> portfolio/account + risk/outlook + scoring factors shape which
                  strategies are valid.
                </li>
                <li>
                  <strong>Symbol/chain stage:</strong> live contract rows are evaluated for feasibility and quality.
                </li>
                <li>
                  <strong>Fit + ranking stage:</strong> candidates are scored, ranked, and packaged with risk/reward
                  rationale.
                </li>
              </ul>
              <p className="resources-doc-footnote">
                Explore the live flow in <Link href="/xstrategybuilder">xStrategyBuilder</Link>, then pressure-test
                assumptions in <Link href="/xchat">xChat</Link>.
              </p>
            </section>

            <section className="resources-doc-section" id="best-prompts">
              <h2>5) How to get the best responses</h2>
              <ul className="resources-doc-list">
                <li>State your objective first (income, hedge, directional, assignment tolerance).</li>
                <li>Give timeframe + risk budget + position constraints in the prompt.</li>
                <li>Ask for alternatives: base case, conservative case, and risk-off adjustment.</li>
                <li>Request explicit assumptions and failure conditions before execution decisions.</li>
              </ul>
            </section>
          </article>
          <GlobalFooter />
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
