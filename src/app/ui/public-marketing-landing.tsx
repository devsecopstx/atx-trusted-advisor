"use client";

import Link from "next/link";

import { LightningBolt } from "@/app/ui/atxfinance-logo";
import { XchatHeaderBrand } from "@/app/ui/xchat-header-brand";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "@/app/ui/product-brand-constants";
import { GlobalFooter } from "@/app/ui/global-footer";
import { LandingProductScreenshot } from "@/app/ui/landing-product-screenshot";
import { EducationalDisclaimerBanner } from "@/app/ui/educational-disclaimer-banner";
import { GoogleGIcon, XLogoIcon } from "@/app/ui/oauth-provider-icons";
import { PublicLandingXchatDemo } from "@/app/ui/public-landing-xchat-demo";

const X_OAUTH_LOGIN = "/api/auth/x/login?next=%2Fxchat";
const XCHAT_GUEST = "/xchat";

/** Drop real captures into `public/landing/` (same names, or change paths here). */
const LANDING_PRODUCT_SHOTS = {
  portfolio: "/landing/portfolio.png",
  xchat: "/landing/xchat.png",
  xoptions: "/landing/xoptions.png"
} as const;

type PublicMarketingLandingProps = {
  googleLoginHref: string | null;
};

export function PublicMarketingLanding({ googleLoginHref }: PublicMarketingLandingProps) {
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
              href={XCHAT_GUEST}
              className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--xf-bg-900)] transition hover:opacity-95 sm:px-5"
              style={{
                background: "var(--xf-gain-green)",
                boxShadow: "0 0 24px -4px color-mix(in srgb, var(--xf-gain-green) 45%, transparent)"
              }}
            >
              Log in or register
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

            <h1 className="mt-2 text-4xl font-bold leading-[1.08] tracking-tighter text-[var(--xf-text-100)] sm:text-5xl md:text-6xl">
              Generate Consistent Income. Spend Just 30–60 Minutes a Week.
            </h1>

            <p className="mt-4 max-w-2xl text-lg font-semibold leading-snug text-[var(--xf-text-200)] sm:text-xl md:text-2xl">
              Hassle-free options income for busy wealth builders — your personal options engine with AI-curated wheel,
              covered-call, and LEAP workflows. Grok-backed xChat and execution-style tools.{" "}
              <span className="text-[var(--xf-text-100)]">One hour a week max.</span>
            </p>

            <ul className="mt-8 max-w-2xl list-none space-y-5 text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Ultra-low time commitment</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Review AI-curated wheel, covered-call, and LEAP recommendations in plain English once a week (or less).
                Approve or tweak in minutes — without hours of charting, scanning, or backtesting.
              </li>
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Hassle-free execution flow</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Broker-aligned order previews and built-in risk guardrails: the workspace flags conflicts, helps with
                position sizing from your book, and surfaces tax and liquidity reminders so trades feel structured and
                reviewable.
              </li>
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Peace of mind for larger portfolios</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Tuned for serious wealth ($500K–$10M+ book sizes) with conservative defaults (e.g. cash-secured puts,
                30–45 DTE, quality underlyings). Disclaimers and audit-friendly flows for RIAs documenting client use —
                systematic, income-focused workflows — not a casino.
              </li>
            </ul>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={X_OAUTH_LOGIN}
                className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-[var(--xf-bg-900)] sm:text-lg"
                style={{
                  background: "var(--xf-gain-green)",
                  boxShadow: "0 0 28px -5px color-mix(in srgb, var(--xf-gain-green) 50%, transparent)"
                }}
              >
                Sign in to start
                <span aria-hidden>→</span>
              </a>
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

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {googleLoginHref ? (
                <a
                  href={googleLoginHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
                >
                  <GoogleGIcon size={20} />
                  Sign in with Google
                </a>
              ) : null}
              <a
                href={X_OAUTH_LOGIN}
                className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-6 py-3 text-sm font-semibold transition ${
                  googleLoginHref
                    ? "border-[var(--xf-gain-green)]/60 bg-transparent text-[var(--xf-gain-green)] hover:bg-[color-mix(in_srgb,var(--xf-gain-green)_12%,transparent)]"
                    : "border-[var(--xf-gain-green)] bg-[var(--xf-gain-green)] text-[var(--xf-bg-900)] hover:opacity-95"
                }`}
              >
                <XLogoIcon size={20} />
                Sign in with X
              </a>
            </div>

            <EducationalDisclaimerBanner className="mt-6 max-w-2xl" />

            <p className="mt-4 text-sm text-[var(--xf-text-400)] sm:mt-6">
              <span className="font-medium text-[var(--xf-text-300)]">One workspace:</span> portfolios &amp; watchlist ·
              xChat (Grok / xAI) · xOptions strategy builder
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
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--xf-gain-green)]">
              Product stack
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tighter text-[var(--xf-text-100)] sm:text-4xl md:text-5xl">
              Books, AI advisor, and options tools — one tenant workspace
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <article className="rounded-[var(--xf-radius-lg)] border border-white/10 bg-black/40 p-6 transition hover:-translate-y-1 hover:border-white/15 sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Portfolios</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Books, accounts, holdings, and desk workflows — scoped to your approved tenant.
              </p>
              <LandingProductScreenshot
                alt="Portfolio workspace screenshot"
                fallbackLabel="export from /portfolio or /portfolios."
                src={LANDING_PRODUCT_SHOTS.portfolio}
              />
            </article>
            <article className="rounded-[var(--xf-radius-lg)] border border-white/10 bg-black/40 p-6 transition hover:-translate-y-1 hover:border-white/15 sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">xChat</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Persona-linked tools and RAG — sign in for live Responses with your data boundaries.
              </p>
              <LandingProductScreenshot
                alt="xChat conversation screenshot"
                fallbackLabel="export from /xchat (signed-in view)."
                src={LANDING_PRODUCT_SHOTS.xchat}
              />
            </article>
            <article className="rounded-[var(--xf-radius-lg)] border border-white/10 bg-black/40 p-6 transition hover:-translate-y-1 hover:border-white/15 sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">xOptions</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Stepped builder, chains, and strategy jobs when your workspace enables them.
              </p>
              <LandingProductScreenshot
                alt="xOptions strategy builder screenshot"
                fallbackLabel="export from /xoptions."
                src={LANDING_PRODUCT_SHOTS.xoptions}
              />
            </article>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-16 sm:py-24" id="xoptions-teaser">
        <div className="mx-auto max-w-screen-2xl px-4 text-center sm:px-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--xf-lightning-yellow)]">
            Access
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-4xl">Approved access for professionals</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--xf-text-300)]">
            Log in or register from xChat to request access. Admins assign roles (viewer, operator, advisor). Tenant
            branding, limits, and audit-friendly defaults apply after sign-in.
          </p>
          <Link
            href={XCHAT_GUEST}
            className="mt-8 inline-flex rounded-full border-2 border-[var(--xf-gain-green)] px-8 py-4 text-base font-semibold text-[var(--xf-gain-green)] transition hover:bg-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)]"
          >
            Log in or register
          </Link>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}
