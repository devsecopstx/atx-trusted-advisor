"use client";

import Link from "next/link";

import { LightningBolt } from "@/app/ui/atxfinance-logo";
import { EducationalDisclaimerBanner } from "@/app/ui/educational-disclaimer-banner";
import { GlobalFooter } from "@/app/ui/global-footer";
import { LandingProductScreenshot } from "@/app/ui/landing-product-screenshot";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "@/app/ui/product-brand-constants";
import { PublicLandingXchatDemo } from "@/app/ui/public-landing-xchat-demo";
import { PoweredByXai } from "@/app/ui/xai-brand-mark";
import { XchatHeaderBrand } from "@/app/ui/xchat-header-brand";
import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";
import { withUtmParams } from "@/lib/marketing/utm";

const REGISTER_TRIAL_HREF = "/account/billing?register=1&plan=basic";
const TRIAL_CTA_LABEL = "Start Free Basic Trial — No Card Required";
const DEFAULT_POST_LOGIN = "/xchat";
const MARKETING_UTM = { utm_source: "x", utm_campaign: "weekly-pulse", utm_medium: "owned-social" } as const;

/** Drop real captures into `public/landing/` (same names, or change paths here). */
const LANDING_PRODUCT_SHOTS = {
  portfolio: "/landing/portfolio.png",
  xchat: "/landing/xchat.png",
  xoptions: "/landing/xoptions.png"
} as const;

export function PublicMarketingLanding() {
  const registerTrialHref = withUtmParams(REGISTER_TRIAL_HREF, MARKETING_UTM);
  const plansHref = withUtmParams("/account/billing", MARKETING_UTM);
  const loginHref = withUtmParams(
    `/login?next=${encodeURIComponent(DEFAULT_POST_LOGIN)}`,
    MARKETING_UTM
  );

  const scrollDemo = () => {
    document.getElementById("xchat-demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)]">
      <nav
        className="sticky top-0 z-50 border-b border-white/10 bg-[var(--xf-bg-900)]/85 backdrop-blur-lg"
        aria-label="Primary"
      >
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-8">
            <Link
              aria-label={USER_PRODUCT_HOME_ARIA_LABEL}
              href="/"
              className="xchat-header-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)]"
            >
              <XchatHeaderBrand />
            </Link>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Link
              href="#resources-pillars"
              className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--xf-text-300)] transition hover:text-[var(--xf-gain-green)] sm:px-4"
            >
              Eight pillars
            </Link>
            <Link
              href="/resources/top-10-hnwi-xchat-prompts"
              className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--xf-text-300)] transition hover:text-[var(--xf-gain-green)] sm:px-4"
            >
              Top 10 HNWI prompts
            </Link>
            <Link
              href={loginHref}
              className="rounded-full px-3 py-2 text-xs font-medium text-[var(--xf-text-400)] underline-offset-4 transition hover:text-[var(--xf-gain-green)] sm:px-4 sm:text-sm"
            >
              Already have an account?
            </Link>
            <Link
              href={registerTrialHref}
              className="rounded-full px-4 py-2 text-center text-sm font-semibold text-[var(--xf-bg-900)] transition hover:opacity-95 sm:max-w-[min(100%,20rem)] sm:px-5 sm:text-base"
              style={{
                background: "var(--xf-gain-green)",
                boxShadow: "0 0 24px -4px color-mix(in srgb, var(--xf-gain-green) 45%, transparent)"
              }}
            >
              {TRIAL_CTA_LABEL}
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-screen-2xl px-4 sm:px-8 flex justify-end">
        <EducationalDisclaimerBanner className="mt-3" />
      </div>

      <header
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(90deg, var(--xf-bg-900) 0%, color-mix(in srgb, var(--xf-surface-700) 55%, var(--xf-bg-800)) 100%)"
        }}
      >
        <div className="mx-auto grid max-w-screen-2xl items-center gap-10 px-4 py-12 sm:px-8 md:grid-cols-2 md:gap-12 md:py-16 lg:py-20">
          <div>
            <div className="mb-6 inline-flex max-w-full flex-wrap items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-5 py-3 sm:mb-7 sm:gap-3 sm:px-6 sm:py-3.5">
              <span className="inline-flex shrink-0 translate-y-px" aria-hidden>
                <LightningBolt size={24} />
              </span>
              <p className="xf-landing-hero-tagline m-0">
                <span className="xf-landing-hero-tagline__rest">No </span>
                <span className="xf-landing-hero-tagline__atoms">Atoms</span>
                <span className="xf-landing-hero-tagline__rest"> Moved — Just </span>
                <span className="xf-landing-hero-tagline__gains">Gains</span>
                <span className="xf-landing-hero-tagline__rest"> Earned.</span>
              </p>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--xf-gain-green)] sm:text-sm">
              aTx Trusted Advisory
            </p>

            <div className="mt-2">
              <PoweredByXai logoClassName="h-5 w-auto sm:h-6" />
            </div>

            <h1 className="mt-2 text-4xl font-bold leading-[1.08] tracking-tighter text-[var(--xf-text-100)] sm:text-5xl md:text-6xl">
              <span className="block">
                Your AI Co-Pilot for Options Income &amp; Portfolio Defense
              </span>
              <span className="mt-3 block text-2xl font-semibold leading-snug tracking-tight text-[var(--xf-text-200)] sm:text-3xl md:text-4xl">
                Built for Real Money
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-lg font-semibold leading-snug text-[var(--xf-text-200)] sm:text-xl md:text-2xl">
              Built for experienced options traders and HNWI books (
              <span className="text-[var(--xf-text-100)]">$1M+ liquid</span>, typically ages 35–65) running covered calls,
              wheels, and iron condors — and for RIAs and family offices rolling out{" "}
              <span className="text-[var(--xf-text-100)]">white-label client portals</span> on a tenant-branded workspace.
            </p>

            <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              Grok-backed xChat, execution-style tools, and defined-risk workflows in one place.
            </p>

            <ul className="mt-8 max-w-2xl list-none space-y-5 text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Not another paper-trading toy</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Real portfolio integration on approved workspaces — your book, watchlists, and desk workflows — not a
                simulated leaderboard.
              </li>
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Operate like a desk</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Alerts, strategy jobs, and vision-paste analysis when your tenant enables them — structured review, not
                endless chart spam.
              </li>
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Tenant branding &amp; professionals</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Approved access, audit-friendly defaults, and branding options for operators — fit for serious wealth and
                firms piloting client-facing portals.
              </li>
            </ul>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={registerTrialHref}
                className="inline-flex max-w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-center text-base font-semibold leading-snug text-[var(--xf-bg-900)] sm:px-8 sm:text-lg"
                style={{
                  background: "var(--xf-gain-green)",
                  boxShadow: "0 0 28px -5px color-mix(in srgb, var(--xf-gain-green) 50%, transparent)"
                }}
              >
                {TRIAL_CTA_LABEL}
                <span aria-hidden>→</span>
              </Link>

              <Link
                href={plansHref}
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold tracking-tight rounded-2xl border border-[var(--xf-gain-green)] text-[var(--xf-gain-green)] hover:bg-[var(--xf-gain-green)] hover:text-[var(--xf-text-100)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                See plans
              </Link>

              <p className="w-full text-sm text-[var(--xf-text-400)] sm:w-auto sm:pl-2">
                <Link className="font-medium text-[var(--xf-text-300)] underline-offset-4 hover:text-[var(--xf-gain-green)] hover:underline" href={loginHref}>
                  Already have an account? Sign in
                </Link>
              </p>

              <button
                type="button"
                onClick={scrollDemo}
                className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-[var(--xf-text-200)] transition hover:border-white/20 hover:text-[var(--xf-text-100)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10" aria-hidden>
                  <LightningBolt size={22} />
                </span>
                <span>
                  <span className="block text-sm font-medium text-[var(--xf-text-100)]">Try xChat preview</span>
                  <span className="text-xs text-[var(--xf-text-400)]">Scrolls to the demo on this page</span>
                </span>
              </button>
            </div>

            <EducationalDisclaimerBanner className="mt-6 max-w-2xl" />

            <p className="mt-4 text-sm text-[var(--xf-text-400)] sm:mt-6">
              <span className="font-medium text-[var(--xf-text-300)]">One workspace:</span> real portfolios &amp;
              watchlist · desk alerts · strategy jobs · xChat (Powered by xAI) · xOptions · tenant branding when enabled
            </p>
          </div>

          <div className="hidden md:block md:self-start">
            <PublicLandingXchatDemo />
          </div>
        </div>

        <div className="border-t border-white/10 px-4 py-8 md:hidden sm:px-8">
          <PublicLandingXchatDemo />
        </div>
      </header>

      <section
        id="platform"
        className="border-t border-white/10 bg-[var(--xf-surface-700)]/40 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mb-12 text-center sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
              PRODUCT STACK
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--xf-text-100)]">
              Real books, Grok advisory, and options tooling — one branded tenant workspace
            </h2>
          </div>
          <div className="grid items-stretch gap-6 md:grid-cols-3 md:gap-8">
            <article className="group flex h-full flex-col rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[var(--xf-surface-700)] p-6 transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Portfolios</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Books, accounts, holdings, and desk workflows — scoped to your approved tenant.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl shadow-[0_0_30px_-10px_var(--xf-gain-green)]">
                <LandingProductScreenshot
                  alt="Portfolio desk screenshot"
                  fallbackLabel="export from /portfolio or /portfolios."
                  src={LANDING_PRODUCT_SHOTS.portfolio}
                />
              </div>
            </article>
            <article className="group flex h-full flex-col rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[var(--xf-surface-700)] p-6 transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">xChat</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Persona-linked tools and RAG — sign in for live Responses with your data boundaries.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl shadow-[0_0_30px_-10px_var(--xf-gain-green)]">
                <LandingProductScreenshot
                  alt="xChat conversation screenshot"
                  fallbackLabel="export from /xchat (signed-in view)."
                  src={LANDING_PRODUCT_SHOTS.xchat}
                />
              </div>
            </article>
            <article className="group flex h-full flex-col rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[var(--xf-surface-700)] p-6 transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">xOptions</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Stepped builder, chains, and strategy jobs when your workspace enables them.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl shadow-[0_0_30px_-10px_var(--xf-gain-green)]">
                <LandingProductScreenshot
                  alt="xOptions strategy builder screenshot"
                  fallbackLabel="export from /xoptions."
                  src={LANDING_PRODUCT_SHOTS.xoptions}
                />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        id="resources-pillars"
        className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,var(--xf-surface-700))] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mb-10 text-center sm:mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
              aTx Trusted Advisory
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-4xl md:text-5xl">
              Eight pillars — options income, risk &amp; execution
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              Educational articles on wheels, CSPs, covered calls, LEAP overlays, multi-book workflows, risk tiers, and
              the path from xChat to IBKR-linked snapshots — public reading;{" "}
              <span className="text-[var(--xf-text-200)]">not individualized advice.</span>
            </p>
          </div>
          <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ADVISORY_RESOURCE_PILLARS.map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/80 p-5 text-left transition hover:border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] hover:bg-[var(--xf-surface-700)] sm:p-6"
                >
                  <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--xf-text-400)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-2 text-lg font-semibold leading-snug text-[var(--xf-text-100)]">{item.label}</span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-[var(--xf-text-400)]">{item.blurb}</span>
                  <span className="mt-4 text-sm font-semibold text-[var(--xf-gain-green)]">
                    Read article <span aria-hidden>→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-white/10 py-16 sm:py-24" id="xoptions-teaser">
        <div className="mx-auto max-w-screen-2xl px-4 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
            ACCESS
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--xf-text-100)]">Approved access for professionals</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
            Start a Basic trial (no card on this step) or request another plan. Admins assign roles (viewer, operator,
            advisor). RIAs and family offices: ask about tenant branding and pilot scopes for client portals. Limits and
            audit-friendly defaults apply after sign-in.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
            <Link
              href={registerTrialHref}
              className="inline-flex max-w-[min(100%,22rem)] items-center justify-center px-6 py-4 text-center text-base font-semibold leading-snug tracking-tight rounded-2xl bg-[var(--xf-gain-green)] text-[var(--xf-bg-900)] hover:scale-[1.02] active:scale-[0.98] transition-all sm:px-8"
            >
              {TRIAL_CTA_LABEL}
            </Link>
            <Link
              href={plansHref}
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold tracking-tight rounded-2xl border border-[var(--xf-gain-green)] text-[var(--xf-gain-green)] hover:bg-[var(--xf-gain-green)] hover:text-[var(--xf-text-100)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              See plans
            </Link>
            <Link
              href={loginHref}
              className="text-sm font-medium text-[var(--xf-text-400)] underline-offset-4 transition hover:text-[var(--xf-gain-green)] hover:underline"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}
