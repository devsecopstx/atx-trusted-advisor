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
import { ExpandableResourceScreenshot } from "../2026-options-income-playbook/expandable-screenshot";

import "../../xchat/xchat.css";
import "../getting-started/resources-getting-started.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cash-Secured Puts Mastery: Conservative Income for HNWI Portfolios | Resources",
  description:
    "Build a conservative options income engine with cash-secured puts and the wheel. xAI guardrails, position sizing, and multi-portfolio workspace integration in xFinance.",
  keywords: ["cash secured puts", "conservative options income", "wheel strategy conservative"],
  alternates: {
    canonical: "/resources/cash-secured-puts-mastery",
  },
  openGraph: {
    title: "Cash-Secured Puts Mastery: Conservative Income for HNWI Portfolios | Resources",
    description:
      "Build a conservative options income engine with cash-secured puts and the wheel. xAI guardrails, position sizing, and multi-portfolio workspace integration in xFinance.",
    type: "article",
  },
};

const DTE_BAND_ROWS: { band: string; role: string; notes: string }[] = [
  {
    band: "30–45 DTE",
    role: "Primary cadence for many conservative CSP programs",
    notes: "Balances theta decay with time to adjust before expiry; pairs well with monthly review rhythms.",
  },
  {
    band: "Shorter (e.g. weekly)",
    role: "Higher turnover, more gamma",
    notes: "Often needs tighter risk monitors — common for tactical overlays, not generic default for wealth-book CSPs.",
  },
  {
    band: "Longer (60+ DTE)",
    role: "Slower theta, wider macro drift",
    notes: "Can suit patient liquidity mandates; watch tied-up collateral vs. other mandates.",
  },
];

export default async function ResourcesCashSecuredPutsMasteryPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Cash-secured puts mastery",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="Cash-secured puts mastery for HNWI portfolios">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Conservative income</p>
          <h1 className="resources-doc-hero__title">
            Cash-Secured Puts Mastery: The Conservative Income Foundation for HNWI Portfolios
          </h1>
          <p className="resources-doc-hero__copy">
            Frame cash-secured puts (CSPs) as the entry leg of a disciplined wheel-style income engine: quality
            underlyings, explicit risk defaults, and workspace-scoped tooling so Grok-backed advice aligns with the book
            you intend — across portfolios when your tenant allows.
          </p>
        </header>

        <section className="resources-doc-section" id="intro">
          <h2>Why CSPs anchor conservative income</h2>
          <p className="resources-doc-section__desc">
            CSPs oblige you to buy stock only at strikes you have capital to support — the premium is income for taking
            that liquidity commitment. For high-net-worth workflows, that fits mandates that prioritize{" "}
            <strong>defined collateral use</strong>, <strong>issuer quality</strong>, and{" "}
            <strong>repeatable sizing rules</strong> over squeezing every nickel of extrinsic value.
          </p>
          <p className="resources-doc-footnote">
            Educational article; not individualized advice.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="dte-quality">
          <h2>30–45 DTE and quality underlyings</h2>
          <p className="resources-doc-section__desc">
            A common conservative band is <strong>roughly 30–45 days to expiration</strong>: enough time for orderly
            rolls if spot moves, without chaining ultra-short gamma unless your policy explicitly allows it. Pair that
            with <strong>liquid options</strong>, names you would own at the strike, and issuer screens your compliance
            stack already respects — CSPs are stock-acquisition tools first; premium second.
          </p>
          <table className="resources-doc-table" aria-label="DTE bands versus roles">
            <thead>
              <tr>
                <th>Expiration band</th>
                <th>Typical role</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {DTE_BAND_ROWS.map((row) => (
                <tr key={row.band}>
                  <td>{row.band}</td>
                  <td>{row.role}</td>
                  <td>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="resources-doc-section" id="risk-defaults">
          <h2>Risk defaults: sizing and guardrails</h2>
          <p className="resources-doc-section__desc">
            Conservative programs usually cap each CSP as a fraction of total liquid net worth or per-ticker book,
            enforce minimum distance OTM (delta or % below spot), and document roll/close rules before trade one.
            xFinance surfaces portfolio and watchlist context in workspace flows so prompts and reviews reference{" "}
            <strong>your</strong> scoped book — not a generic chain screenshot.
          </p>
          <ul className="resources-doc-list">
            <li>
              <strong>Collateral truth.</strong> Cash-secured means cash or Treasury bills earmarked — not implied
              leverage unless your policy explicitly allows margin CSPs.
            </li>
            <li>
              <strong>Concentration.</strong> Track single-name and sector weight if assigned; the wheel’s covered-call
              phase may follow — see{" "}
              <Link href="/resources/building-wheel">Building a wheel</Link>.
            </li>
            <li>
              <strong>Events.</strong> Earnings and ex-div dates can dominate short-dated paths; your checklist should
              say when to skip or widen.
            </li>
          </ul>
        </section>

        <section className="resources-doc-section" id="xai-guardrails">
          <h2>xAI guardrails in xChat</h2>
          <p className="resources-doc-section__desc">
            Grok runs behind tenant persona defaults and published tool/RAG scope — not ad-hoc model shopping. That keeps
            income-strategy chat aligned with approved narratives and reduces prompt-driven drift. Use xChat for
            structured trade review and scenario compare; you remain responsible for suitability and execution.
          </p>
          <p className="resources-doc-section__desc">
            For the broader stack (personas, collections, access), see{" "}
            <Link href="/resources/secret-sauce">Secret sauce</Link> and{" "}
            <Link href="/resources/how-xai-spots-better-wheels">Grok wheel edge</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="workspace">
          <h2>Multi-portfolio workspace &amp; flags</h2>
          <p className="resources-doc-section__desc">
            xFinance ties holdings, watchlist, and xChat preload to the <strong>active portfolio workspace</strong> you
            select — important when one login spans multiple books (family entities, sleeves, or paper vs. live). Scope
            prompts and imports to the portfolio you mean so CSP sizing language matches that book’s cash and risk
            flags.
          </p>
          <ExpandableResourceScreenshot
            src="/landing/portfolio.png"
            alt="myPortfolios (illustrative — product UI evolves)"
          >
            <p className="resources-doc-footnote resources-doc-footnote--full">
              Representative workspace chrome; sign in to see your books. Related:{" "}
              <Link href="/resources/decision-workflow">Decision workflow</Link>.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="wheel-link">
          <h2>CSPs and the conservative wheel</h2>
          <p className="resources-doc-section__desc">
            The wheel often starts with repeated CSP cycles until assignment, then covered calls — a conservative
            framing prioritizes smaller premium per cycle and wider buffers over max yield. If you are new to options
            mechanics, start with{" "}
            <Link href="/resources/getting-started">Getting started with options</Link> and the{" "}
            <Link href="/resources/2026-options-income-playbook">2026 options income playbook</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Review CSP scenarios in xChat →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve risk and may not be suitable for all investors. Past hypothetical examples do not guarantee
            future results.
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
          feedbackPageLabel="Resources · Cash-secured puts mastery"
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
