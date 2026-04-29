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
import { ExpandableResourceScreenshot } from "./expandable-screenshot";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

export const revalidate = 3600;

const REGISTER_TRIAL_HREF = "/account/billing?register=1&plan=basic";

export const metadata: Metadata = {
  title: "2026 Options Income Playbook | Resources",
  description:
    "Generate reliable options income in 2026 with xAI-powered wheel, covered calls, and LEAP workflows. Conservative defaults, risk guardrails, and 30–60 min/week execution for HNWI portfolios.",
  keywords: [
    "2026 options income",
    "options income playbook",
    "wheel strategy 2026",
    "xAI options trading"
  ],
  alternates: {
    canonical: "/resources/2026-options-income-playbook"
  },
  openGraph: {
    title: "2026 Options Income Playbook | Resources",
    description:
      "Generate reliable options income in 2026 with xAI-powered wheel, covered calls, and LEAP workflows. Conservative defaults, risk guardrails, and 30–60 min/week execution for HNWI portfolios.",
    type: "article"
  }
};

const CORE_PILLARS: { strategy: string; risk: string; outlook: string }[] = [
  {
    strategy: "Wheel (CSP → CC cycle)",
    risk: "Moderate–aggressive (volatility, assignment)",
    outlook: "Bullish accumulation cycle"
  },
  {
    strategy: "Covered calls (on shares)",
    risk: "Moderate (capped upside)",
    outlook: "Neutral–bullish (income on long shares)"
  },
  {
    strategy: "LEAP + covered-call overlay",
    risk: "Aggressive (leverage, decay)",
    outlook: "Bullish aggressive (LEAP + overlay income)"
  }
];

const SCENARIO_ROWS: {
  id: string;
  label: string;
  dte: string;
  allocation: string;
  rollStyle: string;
}[] = [
  {
    id: "conservative",
    label: "Conservative",
    dte: "45–60 DTE, wider strikes, smaller size per cycle",
    allocation: "Lower premium book %; prioritize assignment buffers",
    rollStyle: "Early management (~70–80% credit capture), fewer gamma events"
  },
  {
    id: "balanced",
    label: "Balanced",
    dte: "30–45 DTE (desk default band for many income books)",
    allocation: "Split across names; cap per-underlying",
    rollStyle: "Defined roll rules at fixed DTE checkpoints"
  },
  {
    id: "aggressive",
    label: "Aggressive",
    dte: "Shorter DTE for faster turnover (higher ops load)",
    allocation: "Higher turnover requires tighter risk caps",
    rollStyle: "Active rolls around events; strict max-loss policies"
  }
];

function PlaybookCta({ mid }: { mid?: boolean }) {
  return (
    <p
      className={
        mid
          ? "resources-doc-section__desc resources-doc-footnote--full"
          : "resources-doc-section__desc resources-doc-footnote--center"
      }
    >
      <Link href="/xoptions">Build your first 2026 income playbook in xOptions</Link>
      {" → "}
      <Link href={REGISTER_TRIAL_HREF}>Start Free Trial</Link>
    </p>
  );
}

export default async function Resources2026OptionsIncomePlaybookPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · 2026 Options Income Playbook",
        railVariant: "workspace-product"
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="2026 options income playbook">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · 2026 Playbook</p>
          <h1 className="resources-doc-hero__title">The 2026 Options Income Playbook</h1>
          <p className="resources-doc-hero__copy">
            Income-focused options workflows—wheel, covered calls, and LEAP overlays—with conservative defaults you
            can tighten further. Built for busy books: target roughly 30–60 minutes per week of active execution,
            not intraday speculation.
          </p>
        </header>

        <section className="resources-doc-section" id="intro">
          <h2>Market outlook &amp; why income beats speculation</h2>
          <p className="resources-doc-section__desc">
            2026 rewards discipline: defined-risk income structures, explicit roll rules, and position sizing that
            survives gaps and vol spikes. The goal is repeatable premium capture and assignment-aware exits—not
            lottery tickets. aTx Advisor defaults skew conservative on strike distance and book concentration; you stay
            in control while Grok/xChat helps compare scenarios against your live workspace context.
          </p>
          <p className="resources-doc-footnote">
            Educational overview only.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="mid-cta">
          <PlaybookCta mid />
        </section>

        <section className="resources-doc-section" id="pillars">
          <h2>Core income pillars (wheel, covered calls, LEAPs)</h2>
          <p className="resources-doc-section__desc">
            Risk and outlook labels follow the same framing as the internal strategy reference (wheel, covered calls,
            LEAP + covered-call overlay). Use them to sanity-check whether a leg matches your book mandate.
          </p>
          <table className="resources-doc-table" aria-label="Core income pillars risk and outlook">
            <thead>
              <tr>
                <th>Structure</th>
                <th>Risk profile (summary)</th>
                <th>Outlook</th>
              </tr>
            </thead>
            <tbody>
              {CORE_PILLARS.map((row) => (
                <tr key={row.strategy}>
                  <td>{row.strategy}</td>
                  <td>{row.risk}</td>
                  <td>{row.outlook}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="resources-doc-footnote">
            Deeper mechanics:{" "}
            <Link href="/resources/building-wheel">Building a wheel</Link>,{" "}
            <Link href="/resources/getting-started">Getting started with options</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="xai-vs-traditional">
          <h2>xAI vs traditional analysis</h2>
          <p className="resources-doc-section__desc">
            Traditional workflows lean on static screens and manual chain comparison. Grok (via xChat) adds portfolio-
            aware reasoning: it can relate open risk to your accounts, watchlist, and desk fields, then propose 30–45
            DTE setups that fit your guardrails—without replacing your checklist. Ask for alternative strikes,
            roll scenarios, and breakeven math in plain language; keep execution in xOptions where payoff diagrams
            and legs are validated before you trade.
          </p>
        </section>

        <section className="resources-doc-section" id="portfolio-integration">
          <h2>Portfolio integration &amp; sizing rules</h2>
          <p className="resources-doc-section__desc">
            Multi-book professionals switch the active portfolio in the workspace so xChat preloads the right book and{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-sm">atx_function</code> tools stay scoped.
            Size per underlying and per cycle before you open chains; carry the same limits into cash-secured puts and
            covered calls so assignment never breaches your liquidity plan.
          </p>
        </section>

        <section className="resources-doc-section" id="workflow">
          <h2>Step-by-step execution workflow</h2>
          <ol className="resources-doc-list">
            <li>
              <strong>Select workspace scope.</strong> Confirm the target portfolio so holdings and watchlist align
              with the income plan.
            </li>
            <li>
              <strong>Stage in xOptions.</strong> Build or refine wheel / covered-call / diagonal-style legs; inspect
              payoff and breakevens before sending orders elsewhere.
            </li>
            <li>
              <strong>Stress with xChat.</strong> Ask for roll ladders, credit capture exits, and event-risk notes tied
              to your scoped book.
            </li>
            <li>
              <strong>Log and review.</strong> Track cycles in your desk process; adjust DTE and allocation when vol
              regime shifts.
            </li>
          </ol>

          <div className="resources-doc-grid">
            <article className="resources-doc-card">
              <h3>xOptions — strategy workspace</h3>
              <ExpandableResourceScreenshot src="/landing/xoptions.png" alt="xOptions strategy builder screenshot">
                <p className="resources-doc-footnote resources-doc-footnote--full">
                  Open <Link href="/xoptions">xOptions</Link> to model legs and scenarios.
                </p>
              </ExpandableResourceScreenshot>
            </article>
            <article className="resources-doc-card">
              <h3>xChat — Grok-backed advisor</h3>
              <ExpandableResourceScreenshot src="/landing/xchat.png" alt="xChat conversation screenshot">
                <p className="resources-doc-footnote resources-doc-footnote--full">
                  Example prompt: “Given my scoped portfolio, propose two 30–45 DTE covered-call candidates with roll rules
                  if spot drops 5%.” Then validate answers in xOptions.
                </p>
              </ExpandableResourceScreenshot>
            </article>
          </div>
        </section>

        <section className="resources-doc-section" id="scenarios">
          <h2>2026 scenario planner</h2>
          <p className="resources-doc-section__desc">
            Illustrative bands—not predictions. Tune to your mandate, liquidity, and compliance constraints.
          </p>
          <table className="resources-doc-table" aria-label="2026 scenario planner conservative balanced aggressive">
            <thead>
              <tr>
                <th>Profile</th>
                <th>DTE &amp; strikes</th>
                <th>Allocation posture</th>
                <th>Roll / management</th>
              </tr>
            </thead>
            <tbody>
              {SCENARIO_ROWS.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.dte}</td>
                  <td>{row.allocation}</td>
                  <td>{row.rollStyle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="resources-doc-section" id="closing-cta">
          <PlaybookCta />
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve risk and are not suitable for all investors. Past performance does not guarantee future
            results.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader
          current="xchat"
          feedbackPageLabel="Resources · 2026 Options Income Playbook"
          session={session}
        />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body" style={{ padding: "1rem" }}>
        {approved && session ? (
          <AppUserCollapsibleRailLayout rail={workspaceProductRail} railChrome="workspace-product">
            {shellContent}
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref} rail={workspaceProductRail ?? undefined}>
            {shellContent}
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
