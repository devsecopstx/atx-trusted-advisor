import Link from "next/link";

import { EducationalDisclaimerBanner } from "@/app/ui/educational-disclaimer-banner";
import { GlobalFooter } from "@/app/ui/global-footer";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "@/app/ui/product-brand-constants";
import { XchatHeaderBrand } from "@/app/ui/xchat-header-brand";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

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
      <nav
        className="sticky top-0 z-50 border-b border-white/10 bg-[var(--xf-bg-900)]/85 backdrop-blur-lg"
        aria-label="Primary"
      >
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link
            href="/"
            aria-label={USER_PRODUCT_HOME_ARIA_LABEL}
            className="xchat-header-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)]"
          >
            <XchatHeaderBrand />
          </Link>
          <Link
            href="/account/billing?register=1&plan=basic"
            className="rounded-full px-4 py-2 text-center text-sm font-semibold text-[var(--xf-bg-900)] transition hover:opacity-95 sm:px-5 sm:text-base"
            style={{
              background: "var(--xf-gain-green)",
              boxShadow: "0 0 24px -4px color-mix(in srgb, var(--xf-gain-green) 45%, transparent)"
            }}
          >
            Start Basic Trial — No Card
          </Link>
        </div>
      </nav>

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
