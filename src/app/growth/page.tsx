import type { Metadata } from "next";
import Link from "next/link";

import { GlobalFooter } from "@/app/ui/global-footer";
import { PublicMarketingHeader } from "@/app/ui/public-marketing-header";
import { MARKETING_LANDING_XOPTIONS_HREF } from "@/lib/marketing/landing-cta";

export const metadata: Metadata = {
  title: "2026–2027 Growth & Partnerships | xFinance",
  description: "Desk demos, community, Investment Advisor partnerships, and platform pulse for options income professionals.",
};

export default function GrowthPage() {
  const registerHref = "/account/billing?register=1&plan=basic";

  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)]">
      <PublicMarketingHeader
        xoptionsHref={MARKETING_LANDING_XOPTIONS_HREF}
        registerTrialHref={registerHref}
      />

      <div className="mx-auto max-w-screen-xl px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[2px] text-[var(--xf-gain-green)]">2026–2027</p>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight">Desk demos, community &amp; partnerships</h1>
          <p className="mt-4 text-xl text-[var(--xf-text-300)]">
            Pair the on-page xChat preview with recorded strategy-job examples inside approved trials.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-8">
            <h3 className="font-semibold text-lg">Monthly Options Desk with Grok</h3>
            <p className="mt-3 text-[var(--xf-text-300)]">
              Working sessions using published personas. Recordings gated behind Basic trial signup so serious operators opt in.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 p-8">
            <h3 className="font-semibold text-lg">Partnerships</h3>
            <p className="mt-3 text-[var(--xf-text-300)]">
              Targeting Investment Advisor platforms, family-office suites, and adjacent fintechs for co-branded tenants. The MCP repo lowers integration friction.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 p-8 md:col-span-2">
            <h3 className="font-semibold text-lg">Platform Pulse</h3>
            <p className="mt-3 text-[var(--xf-text-300)]">
              Roadmap: anonymized aggregates on income posture and risk tiers — public or in-app pulse when compliance signs off. Not live metrics until shipped.
            </p>
            <p className="mt-4 text-sm text-[var(--xf-text-400)]">
              Interested in early access or partnership discussions?{" "}
              <Link href={registerHref} className="text-[var(--xf-gain-green)] underline">Start a trial</Link> or reach out via the IA pilot form.
            </p>
          </div>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
