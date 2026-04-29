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
  title: "Covered Call Strategies for 2026: Balanced Income | Resources",
  description:
    "Master covered calls for balanced returns in 2026. xAI strike selection, rolling logic, and integration with existing stock holdings in the aTx Advisor workspace.",
  keywords: ["covered calls 2026", "balanced options strategy", "covered call wheel"],
  alternates: {
    canonical: "/resources/covered-calls-2026-balanced-income",
  },
  openGraph: {
    title: "Covered Call Strategies for 2026: Balanced Income | Resources",
    description:
      "Master covered calls for balanced returns in 2026. xAI strike selection, rolling logic, and integration with existing stock holdings in the aTx Advisor workspace.",
    type: "article",
  },
};

const STRIKE_POSTURE_ROWS: { posture: string; intent: string; tradeoff: string }[] = [
  {
    posture: "Further OTM / lower delta",
    intent: "Keep upside room; income per cycle is usually smaller",
    tradeoff: "Caps appreciation later but often respects “don’t sell my winners yet” mandates.",
  },
  {
    posture: "Closer OTM / higher delta",
    intent: "More premium per share per cycle",
    tradeoff: "Assignment risk rises if spot rips through strike — plan rolls or acceptance.",
  },
  {
    posture: "Partial overlay",
    intent: "Sell calls against part of the position",
    tradeoff: "Balances income with explicit retained upside on the unhedged shares.",
  },
];

export default async function ResourcesCoveredCalls2026BalancedIncomePage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · Covered calls 2026",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article
        className="resources-doc-shell"
        aria-label="Covered call strategies for 2026 balanced income"
      >
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Income overlays · 2026</p>
          <h1 className="resources-doc-hero__title">
            Covered Call Strategies for 2026: Balanced Income Generation Without Selling Your Winners
          </h1>
          <p className="resources-doc-hero__copy">
            Use covered calls as <strong>premium against shares you already own</strong> — not as a forced exit. In 2026,
            balanced programs pair sensible strikes and rolls with workspace-aware tooling so Grok-backed strike chat
            references your actual holdings when you are signed in.
          </p>
        </header>

        <section className="resources-doc-section" id="intro">
          <h2>Income without mandatory liquidation</h2>
          <p className="resources-doc-section__desc">
            A covered call is short a call against long stock. If spot finishes above the strike at expiry, shares may be
            called away — but many wealth workflows prefer{" "}
            <strong>OTM strikes</strong>, <strong>partial overlays</strong>, or{" "}
            <strong>rolls</strong> so premium comes in without treating every cycle as “sell the core.” The goal is
            balanced income: clip extrinsic value while keeping structural upside exposure you still believe in.
          </p>
          <p className="resources-doc-footnote">
            Educational article; not individualized advice.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="strike-selection">
          <h2>xAI-assisted strike selection (workflow)</h2>
          <p className="resources-doc-section__desc">
            Grok in xChat can compare strikes in plain language — delta bands, distance from spot, and premium vs.
            upside caps — when your session scopes portfolio context. Effective models follow{" "}
            <strong>persona defaults</strong>; you still set mandate: yield vs. retain upside, tax lots, and corporate
            action awareness.
          </p>
          <table className="resources-doc-table" aria-label="Covered call strike posture versus tradeoffs">
            <thead>
              <tr>
                <th>Posture</th>
                <th>Intent</th>
                <th>Tradeoff</th>
              </tr>
            </thead>
            <tbody>
              {STRIKE_POSTURE_ROWS.map((row) => (
                <tr key={row.posture}>
                  <td>{row.posture}</td>
                  <td>{row.intent}</td>
                  <td>{row.tradeoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="resources-doc-section" id="rolling">
          <h2>Rolling logic (conceptual)</h2>
          <p className="resources-doc-section__desc">
            Rolling typically means closing the short call and opening a new one — often for more time (later expiry)
            and/or a different strike — to manage assignment pressure or harvest another credit. Conservative playbooks
            define <strong>when</strong> to roll (e.g. delta threshold, days to expiry, earnings proximity) before entry
            so decisions are not purely reactive.
          </p>
          <ul className="resources-doc-list">
            <li>
              <strong>Roll up and out.</strong> Common when you want to lift the cap if spot trends through your strike.
            </li>
            <li>
              <strong>Let assignment.</strong> Sometimes acceptable if the strike matched your exit plan — otherwise
              roll or buy back per policy.
            </li>
            <li>
              <strong>Wheel link.</strong> After CSP assignment, covered calls are the typical second leg — see{" "}
              <Link href="/resources/building-wheel">Building a wheel</Link> and{" "}
              <Link href="/resources/cash-secured-puts-mastery">CSP mastery</Link>.
            </li>
          </ul>
        </section>

        <section className="resources-doc-section" id="holdings">
          <h2>Seamless integration with stock holdings</h2>
          <p className="resources-doc-section__desc">
            aTx Advisor pulls positions from your <strong>scoped portfolio workspace</strong> so xChat and desk flows can
            speak in terms of shares on hand, not abstract tickers. Sync the active book before asking Grok to compare
            strikes against “my NVDA/META sleeve” — especially when you maintain multiple portfolios under one login.
          </p>
          <ExpandableResourceScreenshot
            src="/landing/portfolio.png"
            alt="Portfolio holdings workspace (illustrative)"
          >
            <p className="resources-doc-footnote resources-doc-footnote--full">
              Strategy builder and chain tools evolve — use{" "}
              <Link href="/xoptions">xOptions</Link> when enabled for your account.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="xoptions">
          <h2>Strike surfaces and scanners</h2>
          <p className="resources-doc-section__desc">
            For stepped builders and chain-style workflows, the product continues to merge holdings context with options
            tooling where entitlements allow — complementary to narrative strike review in xChat.
          </p>
          <ExpandableResourceScreenshot src="/landing/xoptions.png" alt="xOptions strategy workspace (illustrative)">
            <p className="resources-doc-footnote resources-doc-footnote--full">
              Illustrative UI; availability depends on role, tenant, and options approval flags.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="more">
          <h2>More resources</h2>
          <p className="resources-doc-section__desc">
            <Link href="/resources/2026-options-income-playbook">2026 options income playbook</Link>,{" "}
            <Link href="/resources/how-xai-spots-better-wheels">Grok wheel edge</Link>,{" "}
            <Link href="/resources/getting-started">Getting started with options</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Review covered-call scenarios in xChat →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve risk and may not be suitable for all investors. Covered calls limit upside on the hedged
            shares. Past hypothetical examples do not guarantee future results.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Covered calls 2026" session={session} />
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
