"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

export type ExpandableResourceScreenshotProps = {
  src: string;
  alt: string;
  /** Shown under the thumbnail (e.g. footnote + links). */
  children?: ReactNode;
};

const THUMB_WIDTH = 560;
const THUMB_HEIGHT = 350;

export function ExpandableResourceScreenshot({ src, alt, children }: ExpandableResourceScreenshotProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <div className="mt-2">
        <button
          type="button"
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-[var(--xf-radius-md)] border border-white/15 bg-[var(--xf-surface-700)] text-left outline-none ring-offset-2 ring-offset-[var(--xf-bg-900)] transition hover:border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--xf-gain-green)]"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Open full-size screenshot: ${alt}`}
          onClick={() => setOpen(true)}
        >
          <span className="relative block aspect-[16/10] max-h-40 w-full sm:max-h-44">
            <Image
              alt=""
              aria-hidden
              className="object-cover object-top opacity-95 transition group-hover:opacity-100"
              height={THUMB_HEIGHT}
              sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 520px"
              src={src}
              width={THUMB_WIDTH}
            />
          </span>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--xf-bg-900)_78%,transparent)] py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--xf-text-200)] backdrop-blur-[2px]">
            Click to expand
          </span>
        </button>
      </div>
      {children ? <div className="mt-2">{children}</div> : null}

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,black)] p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="relative max-h-[min(92vh,1125px)] w-full max-w-[min(96vw,1200px)] rounded-[var(--xf-radius-md)] border border-white/20 bg-[var(--xf-surface-700)] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-[1] flex h-9 min-w-9 items-center justify-center rounded-md border border-white/20 bg-[var(--xf-bg-900)] text-lg font-bold leading-none text-[var(--xf-text-100)] transition hover:bg-[color-mix(in_srgb,var(--xf-bg-900)_80%,white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--xf-gain-green)]"
              aria-label="Close expanded image"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <div className="overflow-auto p-2 pt-12 sm:p-4 sm:pt-14">
              <Image
                alt={alt}
                className="h-auto w-full rounded-[calc(var(--xf-radius-md)-4px)] object-contain"
                height={1125}
                priority={false}
                sizes="95vw"
                src={src}
                width={1800}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
