"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const STORAGE_LAST_SYMBOL = "xf_portfolios_last_xoptions_symbol_v1";

function readStoredSymbol(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_LAST_SYMBOL)?.trim().toUpperCase();
    if (raw && /^[A-Z0-9.\-]{1,10}$/.test(raw)) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

type Props = {
  defaultSymbol: string | null;
  /** Tighter layout for collapsed panels (e.g. /portfolios disclosure). */
  compact?: boolean;
};

type Starter = { label: string; href: string };

const STARTERS: Starter[] = [
  { label: "Covered call", href: "/xoptions" },
  { label: "Iron condor", href: "/xoptions" },
  { label: "Wheel", href: "/xoptions" },
  { label: "Credit spread", href: "/xoptions" }
];

function withSymbol(href: string, symbol: string | null): string {
  if (!symbol) {
    return href;
  }
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}symbol=${encodeURIComponent(symbol)}`;
}

export function PortfoliosOptionsHeroCard({ defaultSymbol, compact = false }: Props) {
  const [storedSymbol] = useState<string | null>(() => readStoredSymbol());
  const symbol = storedSymbol ?? defaultSymbol;
  const resumeHref = symbol ? withSymbol("/xoptions", symbol) : "/xoptions";

  return (
    <div
      className={
        compact
          ? "portfolios-options-hero portfolios-options-hero--compact xf-noise-overlay rounded-md border border-[color-mix(in_srgb,var(--xf-gain-green)_28%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_6%,transparent)] p-2.5"
          : "portfolios-options-hero xf-noise-overlay rounded-lg border border-[color-mix(in_srgb,var(--xf-gain-green)_28%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_6%,transparent)] p-4"
      }
    >
      <div className={compact ? "flex items-start gap-2" : "flex items-start gap-3"}>
        <Image
          alt=""
          className={compact ? "h-8 w-8 shrink-0 opacity-95" : "h-10 w-10 shrink-0 opacity-95"}
          height={compact ? 32 : 40}
          src="/branding/xstrategybuilder-topnav-icon-transparent.png"
          width={compact ? 32 : 40}
        />
        <div className="min-w-0 flex-1">
          <p
            className={
              compact
                ? "m-0 text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]"
                : "m-0 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]"
            }
          >
            Options strategy builder
          </p>
          <h2
            className={
              compact
                ? "mt-0.5 text-sm font-semibold leading-snug text-[var(--xf-text-100)]"
                : "mt-1 text-lg font-semibold text-[var(--xf-text-100)]"
            }
          >
            Build income &amp; defined-risk orders
          </h2>
        </div>
      </div>

      <Link
        className={
          compact
            ? "mt-2 inline-flex w-full items-center justify-center rounded-md bg-[var(--xf-gain-green)] px-3 py-2 text-center text-xs font-semibold text-black hover:opacity-90"
            : "mt-4 inline-flex w-full items-center justify-center rounded-md bg-[var(--xf-gain-green)] px-4 py-2.5 text-center text-sm font-semibold text-black hover:opacity-90"
        }
        href={withSymbol("/xoptions", symbol)}
      >
        Build new options strategy
      </Link>

      <div className={compact ? "mt-2 flex flex-wrap gap-1.5" : "mt-3 flex flex-wrap gap-2"}>
        {STARTERS.map((s) => (
          <Link
            key={s.label}
            className={
              compact
                ? "rounded-full border border-white/15 bg-[var(--xf-bg-800)] px-2 py-0.5 text-[0.65rem] text-[var(--xf-text-100)] hover:border-[color-mix(in_srgb,var(--xf-gain-green)_45%,transparent)]"
                : "rounded-full border border-white/15 bg-[var(--xf-bg-800)] px-3 py-1 text-xs text-[var(--xf-text-100)] hover:border-[color-mix(in_srgb,var(--xf-gain-green)_45%,transparent)]"
            }
            href={withSymbol(s.href, symbol)}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className={compact ? "mt-2 border-t border-white/10 pt-2" : "mt-4 border-t border-white/10 pt-3"}>
        <p
          className={
            compact
              ? "m-0 text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--xf-text-300)]"
              : "m-0 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--xf-text-300)]"
          }
        >
          Resume
        </p>
        <ul className={compact ? "mt-1 list-none space-y-0.5 p-0 m-0 text-xs" : "mt-2 list-none space-y-1 p-0 m-0 text-sm"}>
          <li>
            <Link className="text-[var(--xf-gain-green)] hover:underline" href={resumeHref}>
              {symbol ? `Last symbol · ${symbol}` : "Open xOptions"}
            </Link>
            <span
              className={
                compact
                  ? "block text-[0.65rem] leading-snug text-[var(--xf-text-300)]"
                  : "block text-xs text-[var(--xf-text-300)]"
              }
            >
              P&amp;L history lives with your broker — not stored here.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
