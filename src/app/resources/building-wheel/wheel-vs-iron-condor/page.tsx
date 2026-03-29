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

import "../../../xchat/xchat.css";
import "../../getting-started/resources-getting-started.css";

export const dynamic = "force-dynamic";

type ComparisonRow = {
  feature: string;
  optionsWheel: string;
  ironCondor: string;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Type",
    optionsWheel: "Income + potential stock ownership strategy",
    ironCondor: "Pure premium-selling / range-bound credit strategy"
  },
  {
    feature: "Market Outlook",
    optionsWheel: "Mildly bullish (you are happy to own the stock)",
    ironCondor: "Neutral / range-bound (stock should stay sideways)"
  },
  {
    feature: "Core Strategy",
    optionsWheel: "Sell OTM Cash-Secured Put -> If assigned -> Sell OTM Covered Call (repeat)",
    ironCondor: "Sell a Bull Put Spread + Sell a Bear Call Spread (4 legs)"
  },
  {
    feature: "Bias",
    optionsWheel: "Slightly bullish",
    ironCondor: "Non-directional (delta-neutral)"
  },
  {
    feature: "Capital Requirement",
    optionsWheel: "High - You need cash to buy 100 shares if assigned",
    ironCondor: "Low to medium - Defined risk, no stock ownership"
  },
  {
    feature: "Risk Profile",
    optionsWheel: "Undefined risk (stock can drop a lot while you hold it)",
    ironCondor: "Defined risk (max loss is known from day one)"
  },
  {
    feature: "Max Loss",
    optionsWheel: "Potentially large (if stock crashes after assignment)",
    ironCondor: "Limited (difference in strikes minus credit received)"
  },
  {
    feature: "Profit Mechanism",
    optionsWheel: "Premium from puts + calls + possible stock appreciation",
    ironCondor: "Premium decay (theta) when stock stays in a range"
  },
  {
    feature: "Income Style",
    optionsWheel: "Wheel cycle - continuous premium while rotating",
    ironCondor: "One-time credit, usually closed early or at expiration"
  },
  {
    feature: "Stock Ownership",
    optionsWheel: "Yes (you often end up owning shares)",
    ironCondor: "No (100% options only)"
  },
  {
    feature: "Best Market Condition",
    optionsWheel: "Sideways to slightly bullish stocks you like long-term",
    ironCondor: "Sideways, low-volatility environments"
  },
  {
    feature: "Management",
    optionsWheel: "Moderate - You may get assigned and have to manage shares",
    ironCondor: "Higher - Usually needs more active adjustment if tested"
  },
  {
    feature: "Breakeven",
    optionsWheel: "Lower for puts, higher for calls (depends on strikes)",
    ironCondor: "Two breakeven points (upper and lower)"
  },
  {
    feature: "Difficulty",
    optionsWheel: "Easier for beginners once you understand assignment",
    ironCondor: "Slightly more complex (4 legs)"
  },
  {
    feature: "Typical Duration",
    optionsWheel: "30-45 days per leg (can become long-term if assigned)",
    ironCondor: "7-45 days (short-term trades)"
  },
  {
    feature: "Best For",
    optionsWheel: "Investors who want income + are willing to own the stock",
    ironCondor: "Traders who expect the underlying to stay in a range"
  }
];

export default async function WheelVsIronCondorPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const shellContent = (
    <>
      <article className="resources-doc-shell" aria-label="Wheel vs Iron Condor comparison">
        <header className="resources-doc-hero">
          <p className="resources-doc-hero__eyebrow">Resources · Building Wheel</p>
          <h1 className="resources-doc-hero__title">Wheel vs Iron Condor</h1>
          <p className="resources-doc-hero__copy">
            Side-by-side view of the wheel income cycle versus an iron condor credit structure for range-bound
            setups.
          </p>
          <p className="resources-doc-footnote resources-doc-footnote--center">
            <Link href="/resources/building-wheel">Back to Building Wheel</Link>
          </p>
        </header>

        <section className="resources-doc-section">
          <h2>Comparison</h2>
          <table className="resources-doc-table" aria-label="Wheel versus Iron Condor comparison">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Options Wheel</th>
                <th>Iron Condor</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{row.optionsWheel}</td>
                  <td>{row.ironCondor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="resources-doc-footnote resources-doc-footnote--center">
            <span className="xf-disclaimer-emphasis">Not financial advice.</span> Use this comparison for education
            and scenario planning only.
          </p>
        </section>
      </article>
      <GlobalFooter />
    </>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · Wheel vs Iron Condor" session={session} />
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
