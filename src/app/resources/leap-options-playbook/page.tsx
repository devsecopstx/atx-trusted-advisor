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
  title: "LEAP Options Playbook: Growth + Income | Resources",
  description:
    "Use LEAPs for leveraged upside while harvesting income. Aggressive outlook frameworks with xAI and the xOptions strategy builder in xFinance.",
  keywords: ["LEAP options strategy", "aggressive options trading", "LEAPs income"],
  alternates: {
    canonical: "/resources/leap-options-playbook",
  },
  openGraph: {
    title: "LEAP Options Playbook: Growth + Income | Resources",
    description:
      "Use LEAPs for leveraged upside while harvesting income. Aggressive outlook frameworks with xAI and the xOptions strategy builder in xFinance.",
    type: "article",
  },
};

const PLAYBOOK_ROWS: { theme: string; longLeg: string; incomeLeg: string }[] = [
  {
    theme: "Poor man’s covered call (PMCC)",
    longLeg: "Deep ITM long-dated call vs. shares",
    incomeLeg: "Short OTM calls against extrinsic on the long LEAP (repeatable cycles)",
  },
  {
    theme: "Diagonal-style overlays",
    longLeg: "Longer expiry / different strike structure",
    incomeLeg: "Short front-month calls managed with roll rules",
  },
  {
    theme: "Outlook framing",
    longLeg: "Bullish or recovery thesis expressed with defined premium outlay",
    incomeLeg: "Income offsets cost of carry — still path-dependent",
  },
];

export default async function ResourcesLeapOptionsPlaybookPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const workspaceProductRail = session
    ? await AppUserAccountPublicRailForSession({
        session,
        feedbackPageLabel: "Resources · LEAP options playbook",
        railVariant: "workspace-product",
      })
    : null;

  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="LEAP options playbook aggressive growth and income">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · LEAPs · Aggressive outlook</p>
          <h1 className="resources-doc-hero__title">
            LEAP Options Playbook: Aggressive Growth Meets Steady Income Generation
          </h1>
          <p className="resources-doc-hero__copy">
            Long-term equity anticipation securities — <strong>LEAPs</strong> — are long-dated options that can express
            leveraged upside with capped premium at risk. Pair them with{" "}
            <strong>short-dated income overlays</strong> (classic PMCC-style thinking) to harvest recurring premium while
            keeping a growth tilt — then stress scenarios in xChat with workspace context and structured legs in{" "}
            <Link href="/xoptions">xOptions</Link> where enabled.
          </p>
        </header>

        <section className="resources-doc-section" id="intro">
          <h2>Leveraged upside, income on top</h2>
          <p className="resources-doc-section__desc">
            Unlike owning shares alone, a long LEAP ties capital efficiency to volatility and time decay — which cuts both
            ways. Income generation usually means <strong>selling</strong> options against your position (for example
            short calls structured so margin and assignment rules match your account type). The playbook is{" "}
            <strong>not</strong> “set and forget”: rolls, width of strikes, and earnings windows matter as much as the
            bullish thesis.
          </p>
          <p className="resources-doc-footnote">
            Educational article; not individualized advice. LEAP and multi-leg strategies involve substantial risk.{" "}
            <span className="xf-disclaimer-emphasis">Not financial advice.</span>
          </p>
        </section>

        <section className="resources-doc-section" id="frameworks">
          <h2>Aggressive outlook frameworks (conceptual)</h2>
          <p className="resources-doc-section__desc">
            An aggressive <em>outlook</em> here means you accept path risk and complexity in exchange for convexity or
            income — not that outcomes are guaranteed. Common playbook themes:
          </p>
          <table className="resources-doc-table" aria-label="LEAP income playbook themes">
            <thead>
              <tr>
                <th>Theme</th>
                <th>Long leg idea</th>
                <th>Income leg idea</th>
              </tr>
            </thead>
            <tbody>
              {PLAYBOOK_ROWS.map((row) => (
                <tr key={row.theme}>
                  <td>{row.theme}</td>
                  <td>{row.longLeg}</td>
                  <td>{row.incomeLeg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="resources-doc-section" id="xai">
          <h2>xAI for scenario compare</h2>
          <p className="resources-doc-section__desc">
            Grok-backed xChat can outline roll paths, breakeven intuition, and trade-offs between expiries — scoped to
            your tenant persona and <strong>published</strong> knowledge when RAG applies. Use it to rehearse outcomes,
            not to bypass policy: effective models follow persona defaults; you remain responsible for suitability and
            approvals.
          </p>
          <p className="resources-doc-section__desc">
            See also <Link href="/resources/secret-sauce">Secret sauce</Link> for how personas and tools fit together.
          </p>
        </section>

        <section className="resources-doc-section" id="xoptions">
          <h2>xOptions builder integration</h2>
          <p className="resources-doc-section__desc">
            When your account has options entitlements, the stepped builder in xOptions helps translate a thesis into
            legs you can reason about before sending anything live — complementary to narrative planning in xChat.
            Availability depends on role, tenant, and options-approval flags.
          </p>
          <ExpandableResourceScreenshot src="/landing/xoptions.png" alt="xOptions strategy builder (illustrative)">
            <p className="resources-doc-footnote resources-doc-footnote--full">
              UI representative only; features vary by deployment and entitlements.
            </p>
          </ExpandableResourceScreenshot>
        </section>

        <section className="resources-doc-section" id="risks">
          <h2>Risks and discipline</h2>
          <ul className="resources-doc-list">
            <li>
              <strong>Long LEAP decay.</strong> If spot stalls, long-call extrinsic can erode while you manage short
              cycles.
            </li>
            <li>
              <strong>Short-call assignment path.</strong> Structures must match margin rules (cash vs. margin account)
              and how your broker treats calls written against long LEAPs.
            </li>
            <li>
              <strong>Liquidity.</strong> Wide spreads on long-dated chains can dominate outcomes — check OI and width
              before committing size.
            </li>
          </ul>
        </section>

        <section className="resources-doc-section" id="related">
          <h2>Related guides</h2>
          <p className="resources-doc-section__desc">
            <Link href="/resources/covered-calls-2026-balanced-income">Covered calls 2026</Link>,{" "}
            <Link href="/resources/cash-secured-puts-mastery">CSP mastery</Link>,{" "}
            <Link href="/resources/building-wheel">Building a wheel</Link>,{" "}
            <Link href="/resources/2026-options-income-playbook">2026 income playbook</Link>.
          </p>
        </section>

        <section className="resources-doc-section" id="cta">
          <p className="resources-doc-section__desc resources-doc-footnote--center">
            <Link href="/xchat">Talk through LEAP overlays in xChat →</Link>
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--legal">
            Options involve risk of substantial loss. Multi-leg strategies may incur multiple commissions and tax
            complexity. Past hypothetical examples do not guarantee future results.
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
          feedbackPageLabel="Resources · LEAP options playbook"
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
