"use client";

import { XfHoverHint } from "@/app/ui/xf-hover-hint";

type Props = {
  label: string;
  hint: string;
  className?: string;
  /** When false, only the info icon is shown (e.g. beside a toggle button). */
  showLabel?: boolean;
};

/** Column / metric label with circular info trigger (x-style); uses theme-safe {@link XfHoverHint}. */
export function XfColumnHeaderHint({ label, hint, className, showLabel = true }: Props) {
  return (
    <span className={className ? `xf-column-header-hint ${className}` : "xf-column-header-hint"}>
      {showLabel ? <span className="xf-column-header-hint__label">{label}</span> : null}
      <XfHoverHint hint={hint} showDelayMs={150}>
        <button
          type="button"
          className="xf-column-header-hint__trigger"
          aria-label={`About ${label}`}
        >
          <svg aria-hidden className="xf-column-header-hint__icon" viewBox="0 0 16 16">
            <circle cx="8" cy="8" fill="none" r="6.5" stroke="currentColor" strokeWidth="1.15" />
            <circle cx="8" cy="5.35" fill="currentColor" r="0.85" />
            <path
              d="M8 7.15v3.35"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.35"
            />
          </svg>
        </button>
      </XfHoverHint>
    </span>
  );
}
