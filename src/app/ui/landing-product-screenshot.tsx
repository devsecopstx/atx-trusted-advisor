"use client";

import Image from "next/image";
import { useState } from "react";

export type LandingProductScreenshotProps = {
  /** Path under `public/`, e.g. `/landing/portfolio.png` */
  src: string;
  alt: string;
  /** Shown when the file is missing or fails to load */
  fallbackLabel: string;
  /** Eager fetch + high priority — default on for landing product row (guests, fast LCP) */
  priority?: boolean;
};

/**
 * Marketing screenshots from `public/landing/`. Uses `next/image` for sizing + priority load;
 * avoids opacity-until-onLoad (breaks when image is cached before the handler attaches).
 */
export function LandingProductScreenshot({
  src,
  alt,
  fallbackLabel,
  priority = true
}: LandingProductScreenshotProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="mt-4 flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-[var(--xf-radius-md)] border border-dashed border-white/20 bg-[var(--xf-bg-900)]/80 px-3 py-6 text-center sm:min-h-[8rem]">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--xf-text-400)]">Screenshot</span>
        <span className="max-w-[240px] text-xs leading-snug text-[var(--xf-text-400)]">
          Add <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[var(--xf-text-300)]">{src}</code>{" "}
          — {fallbackLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[var(--xf-radius-md)] border border-white/15 bg-[var(--xf-surface-700)] ring-1 ring-inset ring-white/10 xf-shadow-elev-green-soft">
      <div className="relative h-32 w-full sm:h-40 md:h-44">
        <Image
          alt={alt}
          className="object-cover object-top"
          decoding="async"
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 34vw, 420px"
          src={src}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}
