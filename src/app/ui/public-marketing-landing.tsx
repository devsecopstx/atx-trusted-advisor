"use client";

import Link from "next/link";

import { LightningBolt } from "@/app/ui/atxfinance-logo";
import { EducationalDisclaimerBanner } from "@/app/ui/educational-disclaimer-banner";
import { GlobalFooter } from "@/app/ui/global-footer";
import { LandingProductScreenshot } from "@/app/ui/landing-product-screenshot";
import { XFINANCE_BRAND_SUBLINE } from "@/app/ui/product-brand-constants";
import { PublicLandingXchatDemo } from "@/app/ui/public-landing-xchat-demo";
import {
    MARKETING_HEADER_BTN_PRIMARY,
    MARKETING_HEADER_BTN_SECONDARY,
    MARKETING_TRIAL_CTA_LABEL,
    PublicMarketingHeader
} from "@/app/ui/public-marketing-header";
import { PoweredByXai } from "@/app/ui/xai-brand-mark";
import { XfinancePremiumValueBlock } from "@/app/ui/xfinance-premium-value-block";
import { withUtmParams } from "@/lib/marketing/utm";


const REGISTER_TRIAL_HREF = "/account/billing?register=1&plan=basic";
const TRIAL_CTA_LABEL = MARKETING_TRIAL_CTA_LABEL;
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
  const iaPilotHref = withUtmParams(REGISTER_TRIAL_HREF, {
    ...MARKETING_UTM,
    utm_content: "ia-pilot"
  });
  const plansHref = withUtmParams("/account/billing", MARKETING_UTM);
  const loginHref = withUtmParams(
    `/login?next=${encodeURIComponent(DEFAULT_POST_LOGIN)}`,
    MARKETING_UTM
  );

  const scrollDemo = () => {
    document.getElementById("xchat-demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-transparent text-[var(--xf-text-100)]">
      <PublicMarketingHeader loginHref={loginHref} registerTrialHref={registerTrialHref} trialCtaLabel={TRIAL_CTA_LABEL} />

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

            <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-tighter text-[var(--xf-text-100)] sm:text-5xl md:text-6xl">
              <span className="block">Real-Money Options Income.</span>
              <span className="mt-2 block">AI That Understands Your Book.</span>
              <span className="mt-3 block text-2xl font-semibold leading-snug tracking-tight text-[var(--xf-gain-green)] sm:text-3xl md:text-4xl">
                {XFINANCE_BRAND_SUBLINE}
              </span>
            </h1>

            <div className="mt-4">
              <PoweredByXai logoClassName="h-5 w-auto sm:h-6" />
            </div>

            <p className="mt-4 max-w-2xl text-lg font-semibold leading-snug text-[var(--xf-text-200)] sm:text-xl md:text-2xl">
              Austin-built for HNWI retail investors and Investment Advisors — one workspace that combines
              book-aware Grok, production xOptions, and audit-ready portfolio desk tools.
            </p>

            <div className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              <p className="mb-2">
                <span className="font-semibold text-[var(--xf-text-100)]">xChat + RAG</span> — multi-agent orchestration
                with conservative, balanced, and aggressive income playbooks grounded in your holdings.
              </p>
              <p>
                <span className="font-semibold text-[var(--xf-text-100)]">xOptions + desk</span> — chains, payoff
                previews, strategy jobs, alerts, and scanners with an IBKR integration path and full audit lineage.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href={loginHref} className={MARKETING_HEADER_BTN_SECONDARY}>
                Sign In
              </Link>
              <Link href={registerTrialHref} className={MARKETING_HEADER_BTN_PRIMARY}>
                {TRIAL_CTA_LABEL}
                <span
                  aria-hidden
                  className="rounded-xl bg-[color-mix(in_srgb,var(--xf-bg-900)_12%,transparent)] px-2 py-0.5 text-xs font-semibold"
                >
                  →
                </span>
              </Link>

              <Link
                href={plansHref}
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold tracking-tight rounded-2xl border border-[var(--xf-gain-green)] text-[var(--xf-gain-green)] hover:bg-[var(--xf-gain-green)] hover:text-[var(--xf-text-100)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                See plans
              </Link>

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
                  <span className="text-xs text-[var(--xf-text-400)]">
                    Interactive on-page demo · recorded strategy-job examples ship with approved trial workspaces
                  </span>
                </span>
              </button>
            </div>

            <EducationalDisclaimerBanner className="mt-6 max-w-2xl" />

            <p className="mt-4 text-sm text-[var(--xf-text-400)] sm:mt-6">
              <span className="font-medium text-[var(--xf-text-300)]">One workspace:</span> portfolio sync &amp;
              watchlist · desk alerts · scanners · strategy jobs · xChat (Grok) · xOptions · tenant branding when enabled
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

      {/* How it works – short 3-step block for guests */}
      <section className="border-t border-white/10 bg-[var(--xf-surface-700)]/30 py-10 sm:py-12">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[2px] text-[var(--xf-gain-green)] mb-4">How it works</p>
          <div className="grid gap-8 sm:grid-cols-3 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--xf-gain-green)] text-[var(--xf-bg-900)] text-sm font-bold">1</div>
              <h4 className="font-semibold text-[var(--xf-text-100)]">Connect your book</h4>
              <p className="mt-1 text-sm text-[var(--xf-text-300)]">Link portfolios or start with trial data. Your actual positions and watchlist come in automatically.</p>
            </div>
            <div>
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--xf-gain-green)] text-[var(--xf-bg-900)] text-sm font-bold">2</div>
              <h4 className="font-semibold text-[var(--xf-text-100)]">Chat with Grok that sees your book</h4>
              <p className="mt-1 text-sm text-[var(--xf-text-300)]">Ask anything. xChat understands your holdings, risk settings, and desk workflows — no generic advice.</p>
            </div>
            <div>
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--xf-gain-green)] text-[var(--xf-bg-900)] text-sm font-bold">3</div>
              <h4 className="font-semibold text-[var(--xf-text-100)]">Execute with guardrails</h4>
              <p className="mt-1 text-sm text-[var(--xf-text-300)]">Use xOptions builder + scanners. Every idea stays inside your defined risk rules before it becomes a trade.</p>
            </div>
          </div>
        </div>
      </section>

      <XfinancePremiumValueBlock id="premium-value" />

      <section
        id="platform"
        className="border-t border-white/10 bg-[var(--xf-surface-700)]/40 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mb-12 text-center sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
              ONE WORKSPACE
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--xf-text-100)]">
              Your portfolios. Grok that knows them. Execution tools that respect your rules.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--xf-text-300)]">
              Stop jumping between broker, spreadsheet, and generic chat. Everything lives in one place — scoped to what you actually own.
            </p>
          </div>
          <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
            <article className="group flex h-full flex-col rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[var(--xf-surface-700)] p-6 transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Your actual portfolios</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Live sync of books, accounts, and holdings. See exactly what you own before you write another covered call or wheel.
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
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Grok that knows your book</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                xChat answers grounded in your real positions, watchlist, and risk settings — not generic market noise.
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
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">xOptions execution</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Step-by-step strategy builder + live chains. Turn ideas into structured trades without babysitting screens all day.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl shadow-[0_0_30px_-10px_var(--xf-gain-green)]">
                <LandingProductScreenshot
                  alt="xOptions strategy builder screenshot"
                  fallbackLabel="export from /xoptions."
                  src={LANDING_PRODUCT_SHOTS.xoptions}
                />
              </div>
            </article>
            <article className="group flex h-full flex-col rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[var(--xf-surface-700)] p-6 transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Risk you can actually manage</h3>
              <p className="mt-2 flex-1 text-[var(--xf-text-300)]">
                Alerts, scanners, and frameworks that keep your income trades inside explicit risk tiers. Sleep better.
              </p>
              <Link
                href="/resources/options-risk-management-frameworks"
                className="mt-4 inline-flex text-sm font-semibold text-[var(--xf-gain-green)] underline-offset-4 hover:underline"
              >
                See risk frameworks <span aria-hidden>→</span>
              </Link>
            </article>
          </div>
        </div>
      </section>



      <section
        id="social-proof"
        className="border-t border-white/10 bg-[var(--xf-surface-700)]/35 py-14 sm:py-20"
        aria-label="Social proof and case formats"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
                Social proof
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-3xl">
                Anonymized operator voices
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--xf-text-400)]">
                Illustrative anonymized feedback for messaging tests — not a verified third-party efficacy study.
              </p>
              <figure className="mt-8 rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/90 p-6 sm:p-8">
                <blockquote className="text-lg font-medium leading-relaxed text-[var(--xf-text-200)]">
                  “Cut review time roughly 60% on multi-book rebalances — same checklist, fewer spreadsheet passes.”
                </blockquote>
                <figcaption className="mt-4 text-sm text-[var(--xf-text-400)]">Investment Advisor desk lead · multi-strategy book</figcaption>
              </figure>
              <figure className="mt-6 rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/90 p-6 sm:p-8">
                <blockquote className="text-lg font-medium leading-relaxed text-[var(--xf-text-200)]">
                  “Finally one Grok thread that remembers how our wheel sleeves interact with LEAP overlays.”
                </blockquote>
                <figcaption className="mt-4 text-sm text-[var(--xf-text-400)]">Family-office operator · anonymized</figcaption>
              </figure>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Case-study format (diligence)</h3>
              <p className="mt-3 text-base leading-relaxed text-[var(--xf-text-300)]">
                Template we use with pilots: how one HNWI book targets systematic premium with explicit drawdown guardrails
                via xStrategyBuilder — headline metrics stay under NDA until you authorize disclosure. Payoff ladders and
                scenario charts come from xOptions and ship in diligence packs.
              </p>
              <div className="mt-6 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--xf-gain-green)_15%,transparent)] shadow-[0_0_30px_-12px_var(--xf-gain-green)]">
                <LandingProductScreenshot
                  alt="xOptions payoff and scenario chart placeholder for before-after diligence visuals"
                  fallbackLabel="export payoff charts from /xoptions (signed-in)."
                  src={LANDING_PRODUCT_SHOTS.xoptions}
                />
              </div>
              <p className="mt-3 text-xs text-[var(--xf-text-400)]">
                Before/after visuals pair qualitative desk notes with quantitative payoff views — shared only on approved
                workspaces.
              </p>
            </div>
          </div>
        </div>
      </section>



      <section
        id="ia-family-office"
        className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,var(--xf-surface-700))] py-12 sm:py-16"
        aria-label="For Investment Advisors and teams"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">For Investment Advisors &amp; teams</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--xf-text-100)]">White-label workspaces</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--xf-text-300)]">
            Branded tenant portals with role-based access and clean data separation. Built for professionals who need repeatability without custom dev.
          </p>
          <div className="mt-6">
            <Link href="/#ia-family-office" className="text-[var(--xf-gain-green)] font-semibold underline-offset-4 hover:underline">
              Learn about IA pilots →
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,var(--xf-surface-700))] py-12 sm:py-16">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">Educational hub</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--xf-text-100)]">Practical options income content</h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-[var(--xf-text-300)]">
            Wheels, CSPs, covered calls, risk frameworks, and real desk workflows — written for people who actually trade.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/resources/2026-options-income-playbook" className="text-[var(--xf-gain-green)] font-semibold underline-offset-4 hover:underline">
              Read the 2026 playbook →
            </Link>
            <Link href="/resources" className="text-[var(--xf-gain-green)] font-semibold underline-offset-4 hover:underline">
              Browse all resources →
            </Link>
          </div>
        </div>
      </section>



      <section className="border-t border-white/10 py-14 sm:py-20" id="access-cta">
        <div className="mx-auto max-w-screen-2xl px-4 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[2px] text-[var(--xf-gain-green)]">
            GET STARTED
          </p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--xf-text-100)]">
            Start earning with guardrails today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--xf-text-300)]">
            Basic trial. No card required. Connect your portfolios or explore with sample data. Roles and limits apply after sign-in.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href={registerTrialHref} className={MARKETING_HEADER_BTN_PRIMARY}>
              {TRIAL_CTA_LABEL}
              <span aria-hidden className="ml-2">→</span>
            </Link>
            <Link href={loginHref} className={MARKETING_HEADER_BTN_SECONDARY}>
              Sign in with X
            </Link>
          </div>

          <div className="mt-6 text-sm">
            <Link href={iaPilotHref} className="text-[var(--xf-lightning-yellow)] hover:underline">
              Request IA / team pilot
            </Link>
            <span className="mx-2 text-[var(--xf-text-400)]">·</span>
            <Link href={plansHref} className="text-[var(--xf-gain-green)] hover:underline">
              See all plans
            </Link>
          </div>
        </div>
      </section>

      <div className="border-t border-white/10 bg-[var(--xf-bg-900)]">
        <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8">
          <EducationalDisclaimerBanner />
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
