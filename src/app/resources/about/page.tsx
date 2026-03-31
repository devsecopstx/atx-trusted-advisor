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

export const dynamic = "force-dynamic";

const ABOUT_BULLETS: string[] = [
  "Consolidate all your accounts and assets into a single dashboard",
  "Track performance, cash flow, and net worth in real time",
  "Generate clean, professional reports",
  "Collaborate securely with your advisors and family members",
  "Get powerful insights tailored to Austin's unique market — from tech wealth and real estate concentration to Texas tax advantages"
];

export default async function ResourcesAboutPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const article = (
    <article className="resources-doc-shell" aria-label="About aTx Trusted Advisory">
      <header className="resources-doc-hero">
        <p className="resources-doc-hero__eyebrow">Resources · About</p>
        <h1 className="resources-doc-hero__title">About aTx Trusted Advisory</h1>
        <p className="resources-doc-hero__copy resources-doc-hero__copy--full">
          {`Sophisticated portfolio management software for Austin's high-net-worth families and their advisors.`}
        </p>
      </header>

      <section className="resources-doc-section">
        <p className="resources-doc-section__desc">
          Welcome to aTx Trusted Advisory. We built our platform to help high-net-worth families and their trusted
          advisors in the Austin area manage complex family portfolios with clarity and confidence.
        </p>
        <p className="resources-doc-section__desc">
          {`Whether you're overseeing multiple accounts, multiple generations, or a mix of investments and real estate, aTx Trusted Advisory brings everything together in one secure, easy-to-use place. You can:`}
        </p>
        <ul className="resources-about-list">
          {ABOUT_BULLETS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="resources-doc-section__desc">
          {`It's designed specifically for families with portfolios exceeding $1 million and the financial professionals who serve them. Simple enough for daily use, powerful enough for serious wealth management.`}
        </p>
        <p className="resources-doc-section__desc">
          {`At aTx Trusted Advisory, we focus on giving you better visibility, better organization, and better control over your family's financial picture — all in a private, Austin-built platform.`}
        </p>
        <p className="resources-doc-section__desc resources-doc-section__desc--closing">
          {`We'd love to show you how it works.`}
        </p>
      </section>
    </article>
  );

  return (
    <div className="xchat-shell">
      {approved && session ? (
        <AppUserApprovedHeader current="xchat" feedbackPageLabel="Resources · About" session={session} />
      ) : (
        <XchatGuestHeader />
      )}

      <div className="xchat-body" style={{ padding: "1rem" }}>
        {approved && session ? (
          <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
            {article}
            <GlobalFooter />
          </AppUserCollapsibleRailLayout>
        ) : (
          <XchatGuestReadonlyShell googleLoginHref={googleLoginHref}>
            {article}
            <GlobalFooter />
          </XchatGuestReadonlyShell>
        )}
      </div>
    </div>
  );
}
