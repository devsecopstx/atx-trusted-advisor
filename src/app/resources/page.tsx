import type { Metadata } from "next";
import Link from "next/link";

import { GlobalFooter } from "@/app/ui/global-footer";
import { PublicMarketingHeader } from "@/app/ui/public-marketing-header";
import { ADVISORY_RESOURCE_PILLARS } from "@/lib/marketing/advisory-resource-pillars";
import { withUtmParams } from "@/lib/marketing/utm";

export const metadata: Metadata = {
  title: "Educational Hub | Options Income Resources — Wheels, CSPs & Grok Workflows",
  description:
    "Free, practical resources on wheels, cash-secured puts, covered calls, LEAP overlays, risk frameworks, and xChat + xOptions workflows. Written for HNWI and Investment Advisors who want defined-risk income with real portfolio context. Start a free trial to apply everything inside your own book.",
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: "Educational Hub | Options Income Resources",
    description:
      "Practical guides on wheels, CSPs, covered calls, risk management, and Grok-powered xChat/xOptions workflows — grounded in real portfolios. Public reading for serious options income professionals.",
    type: "website",
    images: [
      {
        url: "/landing/xchat.png",
        width: 1800,
        height: 1125,
        alt: "aTx Advisor educational resources for options income strategies"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Options Income Resources | Educational Hub",
    description: "Wheels, CSPs, risk frameworks & Grok workflows — free guides for HNWI and Investment Advisors.",
    images: ["/landing/xchat.png"]
  },
};

export default function ResourcesHubPage() {
  const loginHref = "/login";
  const registerHref = withUtmParams("/account/billing?register=1&plan=basic", {
    utm_source: "resources",
    utm_campaign: "hub",
  });

  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)]">
      <PublicMarketingHeader
        loginHref={loginHref}
        registerTrialHref={registerHref}
      />

      <div className="mx-auto max-w-screen-xl px-6 py-12 sm:py-16">
        {/* Hero - connected to main landing */}
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm">
            <span aria-hidden>⚡</span>
            <span className="font-medium">No Atoms Moved — Just Gains Earned.</span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight">
            Practical options income resources
          </h1>
          <p className="mt-4 text-xl text-[var(--xf-text-300)]">
            One workspace. Your portfolios + Grok that understands them + execution tools with guardrails.
          </p>
          <p className="mt-2 text-sm text-[var(--xf-text-400)]">
            Public reading. Not individualized financial advice.
          </p>
        </div>

        {/* Short "How these resources connect" teaser */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/50 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[2px] text-[var(--xf-gain-green)] mb-3">How these resources fit the workspace</p>
          <div className="grid gap-6 sm:grid-cols-3 text-sm">
            <div>
              <span className="font-semibold text-[var(--xf-text-100)]">1. Connect your book</span><br />
              <span className="text-[var(--xf-text-300)]">Portfolios and watchlists live in one place.</span>
            </div>
            <div>
              <span className="font-semibold text-[var(--xf-text-100)]">2. Learn grounded in reality</span><br />
              <span className="text-[var(--xf-text-300)]">Every article maps directly to xChat + xOptions workflows.</span>
            </div>
            <div>
              <span className="font-semibold text-[var(--xf-text-100)]">3. Apply with guardrails</span><br />
              <span className="text-[var(--xf-text-300)]">Start a free trial and use these ideas on your own data immediately.</span>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={registerHref}
            className="inline-flex items-center justify-center rounded-2xl bg-[var(--xf-gain-green)] px-8 py-3 text-sm font-semibold text-[var(--xf-bg-900)] transition hover:opacity-95"
          >
            Start Basic Trial — No Card
          </Link>
          <Link
            href="/resources/2026-options-income-playbook"
            className="inline-flex items-center justify-center rounded-2xl border border-white/20 px-8 py-3 text-sm font-semibold text-[var(--xf-text-100)] transition hover:border-white/40"
          >
            Read the 2026 Playbook
          </Link>
        </div>

        {/* Main Pillars Grid */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--xf-text-100)]">
            Core Resources
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADVISORY_RESOURCE_PILLARS.map((pillar) => (
              <Link
                key={pillar.href}
                href={pillar.href}
                className="group flex h-full flex-col rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/70 p-6 transition hover:border-[color-mix(in_srgb,var(--xf-gain-green)_25%,transparent)]"
              >
                <span className="text-lg font-semibold text-[var(--xf-text-100)] group-hover:text-[var(--xf-gain-green)]">
                  {pillar.label}
                </span>
                <span className="mt-2 flex-1 text-sm leading-relaxed text-[var(--xf-text-300)]">
                  {pillar.blurb}
                </span>
                <span className="mt-4 text-sm font-semibold text-[var(--xf-gain-green)]">
                  Read article <span aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Additional Hubs */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <Link
            href="/resources/guides"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/60 p-6 hover:border-white/20"
          >
            <div>
              <div className="font-semibold">Guides &amp; Playbooks</div>
              <div className="text-sm text-[var(--xf-text-300)]">
                Deeper dives and structured workflows
              </div>
            </div>
            <span className="text-[var(--xf-gain-green)]">→</span>
          </Link>

          <Link
            href="/resources/about"
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-[var(--xf-surface-700)]/60 p-6 hover:border-white/20"
          >
            <div>
              <div className="font-semibold">About the Pillars</div>
              <div className="text-sm text-[var(--xf-text-300)]">
                How these resources are organized
              </div>
            </div>
            <span className="text-[var(--xf-gain-green)]">→</span>
          </Link>
        </div>

        <div className="mt-12 text-center text-sm text-[var(--xf-text-400)]">
          Ready to put this into practice?{" "}
          <Link href={registerHref} className="text-[var(--xf-gain-green)] underline-offset-4 hover:underline">
            Start a free Basic trial
          </Link>{" "}
          (no card) and explore with your own data or sample books.
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
