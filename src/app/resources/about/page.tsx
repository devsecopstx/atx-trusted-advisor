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

type AboutCard = {
  id: string;
  title: string;
  body: string;
};

const ABOUT_CARDS: AboutCard[] = [
  {
    id: "discover",
    title: "Discover",
    body: "Find new opportunities with scanner surfaces, seller workflows, and watchlist-driven idea generation."
  },
  {
    id: "analyze",
    title: "Analyze",
    body: "Evaluate probability, volatility, and position scenarios before committing capital."
  },
  {
    id: "build",
    title: "Build",
    body: "Compose multi-leg options strategies and inspect payoff behavior directly in the strategy workspace."
  },
  {
    id: "execute",
    title: "Execute",
    body: "Move from analysis to action with clear leg context, trade intent, and disciplined order flow."
  },
  {
    id: "manage-refine",
    title: "Manage & Refine",
    body: "Adjust legs, strikes, and expirations over time as market conditions and risk constraints evolve."
  }
];

export default async function ResourcesAboutPage() {
  const session = await getSessionUser();
  const approved = session ? canUserLogin(session.roles) : false;
  const googleLoginHref = isGoogleOAuthConfigured()
    ? `/api/auth/google/login?next=${encodeURIComponent("/xchat")}`
    : null;
  const article = (
    <article className="resources-doc-shell" aria-label="About resources">
      <header className="resources-doc-hero">
        <p className="resources-doc-hero__eyebrow">Resources · About</p>
        <h1 className="resources-doc-hero__title">workflow at a glance</h1>
        <p className="resources-doc-hero__copy resources-doc-hero__copy--full">
          Decision Insights, to provide end-to-end flow for options users: discover opportunities,
          analyze risk/reward, build strategy legs decision insights.
        </p>
        <p className="resources-doc-hero__copy resources-doc-hero__copy--full">
          * future * (premium+) execute with intent, and manage positions as conditions change.
        </p>
      </header>

      <section className="resources-doc-section">
        <h2>Platform flow</h2>
        <p className="resources-doc-section__desc">
          Illustrative overview, mirrors the product workflow used by approved users across xChat, portfolio, watchlist,
          and xStrategyBuilder.
        </p>
        <div className="resources-about-grid" role="list" aria-label="About flow cards">
          {ABOUT_CARDS.map((card) => (
            <article
              key={card.id}
              className={`resources-about-card resources-about-card--${card.id}`}
              role="listitem"
            >
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
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
