"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { LucideMenuIcon, LucideXIcon } from "@/app/ui/lucide-product-icons";
import { USER_PRODUCT_HOME_ARIA_LABEL } from "@/app/ui/product-brand-constants";
import { XchatHeaderBrand } from "@/app/ui/xchat-header-brand";
import type { GuestLandingVariant } from "@/lib/marketing/guest-landing-variant";
import { MARKETING_LANDING_XOPTIONS_CTA_LABEL } from "@/lib/marketing/landing-cta";

export const MARKETING_TRIAL_CTA_LABEL = "Start Basic Trial — No Card";

export const MARKETING_HEADER_BTN_SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/70 px-6 text-sm font-semibold text-[var(--xf-text-100)] transition-all duration-200 hover:scale-[1.02] hover:border-white/90 hover:bg-white/10 active:scale-[0.98] sm:text-base";

export const MARKETING_HEADER_BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--xf-gain-green)] px-6 text-sm font-semibold text-[var(--xf-bg-900)] shadow-[0_0_24px_-4px_color-mix(in_srgb,var(--xf-gain-green)_45%,transparent)] transition-all duration-200 hover:scale-[1.02] hover:opacity-95 active:scale-[0.98] sm:text-base";

function marketingNavLinks(variant: GuestLandingVariant): { href: string; label: string }[] {
  if (variant === "advisor") {
    return [
      { href: "/ia-white-label-platform", label: "White-label platform" },
      { href: "/growth", label: "Book demo" }
    ];
  }
  return [
    { href: "/resources", label: "Educational hub" },
    { href: "/xoptions", label: "xOptions demo" }
  ];
}

type MarketingHeaderCtasProps = {
  xoptionsHref: string;
  registerTrialHref: string;
  trialCtaLabel: string;
  className?: string;
  primaryFullWidth?: boolean;
  secondaryFullWidth?: boolean;
  onNavigate?: () => void;
};

function MarketingHeaderCtas({
  xoptionsHref,
  registerTrialHref,
  trialCtaLabel,
  className,
  primaryFullWidth,
  secondaryFullWidth,
  onNavigate
}: MarketingHeaderCtasProps) {
  const widthClass = (full?: boolean) => (full ? "w-full" : "");

  return (
    <div className={className}>
      <Link
        href={xoptionsHref}
        className={`${MARKETING_HEADER_BTN_SECONDARY} ${widthClass(secondaryFullWidth)}`}
        onClick={onNavigate}
      >
        {MARKETING_LANDING_XOPTIONS_CTA_LABEL}
      </Link>
      <Link
        href={registerTrialHref}
        className={`${MARKETING_HEADER_BTN_PRIMARY} ${widthClass(primaryFullWidth)}`}
        onClick={onNavigate}
      >
        {trialCtaLabel}
        <span
          aria-hidden
          className="rounded-xl bg-[color-mix(in_srgb,var(--xf-bg-900)_12%,transparent)] px-2 py-0.5 text-xs font-semibold"
        >
          →
        </span>
      </Link>
    </div>
  );
}

type PublicMarketingHeaderProps = {
  xoptionsHref: string;
  registerTrialHref: string;
  trialCtaLabel?: string;
  variant?: GuestLandingVariant;
};

export function PublicMarketingHeader({
  xoptionsHref,
  registerTrialHref,
  trialCtaLabel = MARKETING_TRIAL_CTA_LABEL,
  variant = "hnwi"
}: PublicMarketingHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerId = useId();

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMobile();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, closeMobile]);

  return (
    <nav
      className="sticky top-0 z-50 border-b border-white/10 bg-[color-mix(in_srgb,var(--xf-bg-900)_82%,transparent)] backdrop-blur-lg"
      aria-label="Primary"
    >
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link
          aria-label={USER_PRODUCT_HOME_ARIA_LABEL}
          href="/"
          className="xchat-header-brand shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)]"
        >
          <XchatHeaderBrand />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {marketingNavLinks(variant).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[var(--xf-text-300)] transition-colors hover:text-[var(--xf-gain-green)]"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <MarketingHeaderCtas
          className="hidden items-center gap-3 md:flex"
          xoptionsHref={xoptionsHref}
          registerTrialHref={registerTrialHref}
          trialCtaLabel={trialCtaLabel}
        />

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--xf-text-100)] transition hover:bg-white/10 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls={drawerId}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <LucideXIcon className="h-6 w-6" /> : <LucideMenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen ? (
        <div
          id={drawerId}
          className="fixed inset-0 top-16 z-40 flex flex-col bg-[color-mix(in_srgb,var(--xf-bg-900)_96%,transparent)] p-6 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <button
            type="button"
            className="absolute inset-0 -z-10 cursor-default"
            aria-label="Close menu backdrop"
            tabIndex={-1}
            onClick={closeMobile}
          />
          <div className="flex flex-col gap-1">
            {marketingNavLinks(variant).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-white/10 py-3 text-lg font-medium text-[var(--xf-text-100)] transition-colors hover:text-[var(--xf-gain-green)]"
                onClick={closeMobile}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <MarketingHeaderCtas
            className="mt-auto flex flex-col gap-4 pt-8"
            xoptionsHref={xoptionsHref}
            registerTrialHref={registerTrialHref}
            trialCtaLabel={trialCtaLabel}
            primaryFullWidth
            secondaryFullWidth
            onNavigate={closeMobile}
          />
        </div>
      ) : null}
    </nav>
  );
}
