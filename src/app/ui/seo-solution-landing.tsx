import Link from "next/link";

import { EducationalDisclaimerBanner } from "@/app/ui/educational-disclaimer-banner";
import { GlobalFooter } from "@/app/ui/global-footer";
import { PublicMarketingHeader } from "@/app/ui/public-marketing-header";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";
import { MARKETING_LANDING_XOPTIONS_HREF } from "@/lib/marketing/landing-cta";

const SEO_REGISTER_TRIAL_HREF = "/account/billing?register=1&plan=basic";

export type SeoSolutionLandingProps = {
  h1: string;
  lead: string;
  bullets: readonly string[];
  primaryResourceHref?: string;
  primaryResourceLabel?: string;
};

export function SeoSolutionLanding({
  h1,
  lead,
  bullets,
  primaryResourceHref,
  primaryResourceLabel
}: SeoSolutionLandingProps) {
  return (
    <div className="min-h-screen bg-[var(--xf-bg-900)] text-[var(--xf-text-100)]">
      <PublicMarketingHeader xoptionsHref={MARKETING_LANDING_XOPTIONS_HREF} registerTrialHref={SEO_REGISTER_TRIAL_HREF} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--xf-gain-green)]">aTx Trusted Advisory</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--xf-text-100)] sm:text-4xl md:text-5xl">{h1}</h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--xf-text-300)] sm:text-xl">{lead}</p>
        <ul className="mt-8 list-none space-y-4 text-base leading-relaxed text-[var(--xf-text-300)] sm:text-lg">
          {bullets.map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--xf-gain-green)]" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        {primaryResourceHref && primaryResourceLabel ? (
          <p className="mt-10">
            <Link
              href={primaryResourceHref}
              className="inline-flex text-base font-semibold text-[var(--xf-gain-green)] underline-offset-4 hover:underline"
            >
              {primaryResourceLabel} <span aria-hidden>→</span>
            </Link>
          </p>
        ) : null}
        <p className="mt-10 text-sm text-[var(--xf-text-400)]">{EDUCATIONAL_ONLY_SHORT}</p>
        <p className="mt-6">
          <Link href="/" className="text-sm font-semibold text-[var(--xf-text-300)] underline-offset-4 hover:text-[var(--xf-gain-green)] hover:underline">
            ← Back to home
          </Link>
        </p>
      </main>

      <div className="border-t border-white/10 px-4 py-8 sm:px-8">
        <EducationalDisclaimerBanner />
      </div>
      <GlobalFooter />
    </div>
  );
}
