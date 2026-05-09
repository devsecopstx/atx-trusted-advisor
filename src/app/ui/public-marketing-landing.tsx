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
import { resolveXfinanceAdvisorMcpUrl } from "@/lib/marketing/xfinance-advisor-mcp";

const REGISTER_TRIAL_HREF = "/account/billing?register=1&plan=basic";
const TRIAL_CTA_LABEL = "Start Basic Trial — No Card";
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
  const playbookPdfTrialHref = withUtmParams(REGISTER_TRIAL_HREF, {
    ...MARKETING_UTM,
    utm_content: "playbook-pdf"
  });
  const riaPilotHref = withUtmParams(REGISTER_TRIAL_HREF, {
    ...MARKETING_UTM,
    utm_content: "ria-pilot"
  });
  const mcpRepoHref = resolveXfinanceAdvisorMcpUrl();
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
      <nav
        className="sticky top-0 z-50 border-b border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_82%,transparent)] backdrop-blur-lg"
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
              Educational hub
            </Link>
            <Link
              href="#developers-agents"
              className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--xf-text-300)] transition hover:text-[var(--xf-gain-green)] sm:px-4"
            >
              Developers
            </Link>
            <Link
              href="#growth-2026"
              className="rounded-full px-3 py-2 text-sm font-semibold text-[var(--xf-text-300)] transition hover:text-[var(--xf-gain-green)] sm:px-4"
            >
              Desk series
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

            <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-tighter text-[var(--xf-text-100)] sm:text-5xl md:text-6xl">
              <span className="block">Real-Money Options Income.</span>
              <span className="mt-2 block">AI That Understands Your Book.</span>
              <span className="mt-3 block text-2xl font-semibold leading-snug tracking-tight text-[var(--xf-gain-green)] sm:text-3xl md:text-4xl">
                Powered by xAI Grok.
              </span>
            </h1>

            <div className="mt-4">
              <PoweredByXai logoClassName="h-5 w-auto sm:h-6" />
            </div>

            <p className="mt-4 max-w-2xl text-lg font-semibold leading-snug text-[var(--xf-text-200)] sm:text-xl md:text-2xl">
              Wheel, covered calls, CSPs &amp; LEAP overlays — with portfolio context, risk guardrails, and audit trails.
              No paper. No hype.
            </p>

            <ul className="mt-8 max-w-2xl list-none space-y-5 text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Book-aware, not generic chat</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Approved workspaces scope portfolios, watchlists, and desk workflows so prompts stay grounded in your
                positions — not a toy leaderboard.
              </li>
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Guardrails you can explain</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Tenant isolation, role-aware access (viewer / operator / advisor), and lineage-friendly defaults for
                operators who answer to risk and compliance.
              </li>
              <li>
                <span className="font-semibold text-[var(--xf-text-100)]">Execution-style tooling</span>
                <span className="text-[var(--xf-text-400)]"> — </span>
                Strategy jobs, scanners, and vision-assisted review when your tenant enables them — structured workflows,
                not endless chart spam.
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

      <section
        id="trust-bar"
        className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,var(--xf-surface-700))] py-8 sm:py-10"
        aria-label="Trust and platform posture"
      >
        <div className="mx-auto max-w-screen-2xl px-4 text-center sm:px-8">
          <p className="mx-auto max-w-4xl text-sm font-medium leading-relaxed text-[var(--xf-text-300)] sm:text-base md:text-lg">
            <span className="text-[var(--xf-text-100)]">Enterprise-grade</span>
            {" "}
            (Spring/Kotlin backend, tenant isolation, full audit lineage). Used by operators managing multi-million-dollar
            books.
          </p>
        </div>
      </section>

      <section
        id="platform"
        className="border-t border-white/10 bg-[var(--xf-surface-700)]/40 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mb-12 text-center sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
              PRODUCT PILLARS
            </p>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--xf-text-100)]">
              Portfolios, Grok advisory, options jobs, and risk — one branded tenant workspace
            </h2>
          </div>
          <div className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
            <article className="group flex h-full flex-col rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[var(--xf-surface-700)] p-6 transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] sm:p-8">
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Portfolios</h3>
              <p className="mt-2 text-[var(--xf-text-300)]">
                Real sync path on approved workspaces — books, accounts, holdings, and desk workflows tied to your tenant.
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
                Grok-backed Responses with persona-linked tools, RAG, and vision paste when your tenant enables it — scoped
                to your book.
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
                Stepped builder, chains, and orchestrated strategy jobs when your workspace enables them.
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
              <h3 className="text-xl font-semibold text-[var(--xf-text-100)]">Risk &amp; scanners</h3>
              <p className="mt-2 flex-1 text-[var(--xf-text-300)]">
                Desk alerts, watchlist workflows, and frameworks that keep income trades inside explicit risk tiers after
                sign-in.
              </p>
              <Link
                href="/resources/options-risk-management-frameworks"
                className="mt-4 inline-flex text-sm font-semibold text-[var(--xf-gain-green)] underline-offset-4 hover:underline"
              >
                Risk frameworks overview <span aria-hidden>→</span>
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section
        id="content-series"
        className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_94%,var(--xf-surface-700))] py-14 sm:py-18"
        aria-label="Content series and distribution"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
              Content velocity
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-3xl md:text-4xl">
              Eight pillars → weekly narrative engine
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              Repurpose monorepo options-coreskills arcs into a weekly newsletter plus LinkedIn/X drops — working title{" "}
              <span className="font-semibold text-[var(--xf-text-200)]">“Grok Wheel Edge This Week.”</span> Each cycle maps
              to a pillar article so education, social, and product story stay aligned.
            </p>
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
                <figcaption className="mt-4 text-sm text-[var(--xf-text-400)]">RIA desk lead · multi-strategy book</figcaption>
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
        id="developers-agents"
        className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,var(--xf-surface-700))] py-14 sm:py-20"
        aria-label="Developers and MCP"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="flex flex-col gap-8 rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_18%,transparent)] bg-[var(--xf-surface-700)]/70 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
                For developers &amp; agents
              </p>
              <h2 className="mt-3 text-2xl font-extrabold text-[var(--xf-text-100)] sm:text-3xl">xfinance-advisor-mcp</h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
                Grok-powered rental AI API posture for your stack — tenant-safe calls scoped to approved portfolios and
                roles. Wire agents and internal tools without melting data boundaries.
              </p>
              <p className="mt-3 text-sm text-[var(--xf-text-400)]">
                Default link points at the public MCP repository; override with{" "}
                <span className="font-mono text-[var(--xf-text-300)]">NEXT_PUBLIC_XFINANCE_ADVISOR_MCP_URL</span> when your
                fork is canonical.
              </p>
            </div>
            <a
              href={mcpRepoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-full px-8 py-4 text-center text-base font-semibold text-[var(--xf-bg-900)] transition hover:opacity-95"
              style={{
                background: "var(--xf-gain-green)",
                boxShadow: "0 0 28px -5px color-mix(in srgb, var(--xf-gain-green) 50%, transparent)"
              }}
            >
              Open MCP repo
            </a>
          </div>
        </div>
      </section>

      <section
        id="seo-solutions"
        className="border-t border-white/10 bg-[var(--xf-surface-700)]/25 py-14 sm:py-18"
        aria-label="SEO solution pages"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mb-8 text-center sm:mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">SEO landing pages</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-3xl md:text-4xl">
              Intent-specific entry points
            </h2>
          </div>
          <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { href: "/wheel-strategy-ai", label: "Wheel Strategy AI", blurb: "Income loops + Grok context." },
                {
                  href: "/covered-call-portfolio-manager",
                  label: "Covered Call Portfolio Manager",
                  blurb: "Inventory-aware overlays."
                },
                { href: "/ibkr-options-automation", label: "IBKR Options Automation", blurb: "Snapshots → jobs pathway." },
                { href: "/ria-white-label-platform", label: "RIA White Label Platform", blurb: "Branded tenant portals." }
              ] as const
            ).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/85 p-5 transition hover:border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] sm:p-6"
                >
                  <span className="text-lg font-semibold text-[var(--xf-text-100)]">{item.label}</span>
                  <span className="mt-2 flex-1 text-sm text-[var(--xf-text-400)]">{item.blurb}</span>
                  <span className="mt-4 text-sm font-semibold text-[var(--xf-gain-green)]">
                    View page <span aria-hidden>→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="ria-family-office"
        className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,var(--xf-surface-700))] py-16 sm:py-20"
        aria-label="RIA and family office programs"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
              RIAs &amp; family offices
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-4xl md:text-5xl">
              White-label tenant portals
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              Pilot branded workspaces with segregated data, structured roles (
              <span className="text-[var(--xf-text-200)]">viewer</span>,{" "}
              <span className="text-[var(--xf-text-200)]">operator</span>,{" "}
              <span className="text-[var(--xf-text-200)]">advisor</span>
              ), and YAML-driven tenant provisioning for repeatability across desks — professional rollout without duct tape.
            </p>
            <p className="mt-6 text-sm text-[var(--xf-text-400)]">
              Compliance review and contracts apply; featured capabilities ship only when enabled for your tenant.
            </p>
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
              Educational hub
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-4xl md:text-5xl">
              Eight pillars — options income, risk &amp; execution
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              Deep dives on wheels, CSPs, covered calls, LEAP overlays, multi-book workflows, risk tiers, and the path from
              xChat to broker-linked snapshots — public reading;{" "}
              <span className="text-[var(--xf-text-200)]">not individualized advice.</span>
            </p>
          </div>

          <div className="mb-10 flex flex-col items-stretch justify-center gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--xf-gain-green)_22%,transparent)] bg-[var(--xf-surface-700)]/90 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8">
            <div className="text-left">
              <h3 className="text-lg font-semibold text-[var(--xf-text-100)] sm:text-xl">2026 options income playbook</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--xf-text-400)] sm:text-base">
                Read the hub article now, or start a Basic trial (no card) to unlock PDF collateral on approved workspaces —
                gated lead flow tags your signup for fulfillment.
              </p>
              <Link
                href="/resources/2026-options-income-playbook"
                className="mt-4 inline-flex text-sm font-semibold text-[var(--xf-gain-green)] underline-offset-4 hover:underline sm:text-base"
              >
                Read playbook online <span aria-hidden>→</span>
              </Link>
            </div>
            <Link
              href={playbookPdfTrialHref}
              className="inline-flex shrink-0 items-center justify-center rounded-full px-6 py-3.5 text-center text-sm font-semibold text-[var(--xf-bg-900)] sm:px-8 sm:text-base"
              style={{
                background: "var(--xf-gain-green)",
                boxShadow: "0 0 24px -4px color-mix(in srgb, var(--xf-gain-green) 45%, transparent)"
              }}
            >
              Download playbook PDF
            </Link>
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

      <section
        id="growth-2026"
        className="border-t border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_90%,var(--xf-surface-700))] py-16 sm:py-22"
        aria-label="Growth programs 2026"
      >
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--xf-gain-green)]">
              2026–2027 growth lane
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--xf-text-100)] sm:text-4xl md:text-5xl">
              Desk demos, community, partnerships, pulse
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
              Pair the on-page xChat preview with recorded strategy-job examples inside approved trials. Monthly{" "}
              <span className="font-semibold text-[var(--xf-text-200)]">Options Desk with Grok</span> working sessions (you +
              published personas) — recordings gated behind Basic trial signup so serious operators opt in.
            </p>
          </div>
          <ul className="mx-auto mt-12 grid max-w-4xl list-none gap-6 text-left sm:grid-cols-2">
            <li className="rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/80 p-6">
              <h3 className="text-lg font-semibold text-[var(--xf-text-100)]">Partnerships</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--xf-text-400)]">
                Target RIA platforms, family-office suites, and adjacent fintechs for co-branded tenants — MCP repo lowers
                integration friction for engineering teams.
              </p>
            </li>
            <li className="rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/80 p-6">
              <h3 className="text-lg font-semibold text-[var(--xf-text-100)]">Platform Pulse (tease)</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--xf-text-400)]">
                Roadmap: anonymized aggregates on income posture and risk tiers — public or in-app pulse when compliance
                signs off. Not live metrics until shipped.
              </p>
            </li>
            <li className="rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/80 p-6 sm:col-span-2">
              <h3 className="text-lg font-semibold text-[var(--xf-text-100)]">Paid acquisition alignment</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--xf-text-400)]">
                LinkedIn campaigns aimed at HNWI-aged professionals (35–65) plus sponsored thought leadership — pair with{" "}
                <span className="font-semibold text-[var(--xf-text-300)]">Request RIA Pilot</span> CTAs for institutional
                funnel air-cover.
              </p>
            </li>
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
              href={riaPilotHref}
              className="inline-flex max-w-[min(100%,22rem)] items-center justify-center px-6 py-4 text-center text-base font-semibold leading-snug tracking-tight rounded-2xl border border-[var(--xf-lightning-yellow)] text-[var(--xf-lightning-yellow)] hover:bg-[color-mix(in_srgb,var(--xf-lightning-yellow)_12%,transparent)] transition-all sm:px-8"
            >
              Request RIA Pilot
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

      <div className="border-t border-white/10 bg-[var(--xf-bg-900)]">
        <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8">
          <EducationalDisclaimerBanner />
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
