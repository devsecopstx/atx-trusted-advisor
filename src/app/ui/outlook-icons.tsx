import type { AccountOutlook } from "@/modules/core-admin/types";

type IconProps = {
  className?: string;
};

/**
 * Mini “price trend” glyphs (finance-app convention: up / flat / down).
 * Stroke icons — match {@link SaveIcon} / crud-icons sizing (14–16px, viewBox 24).
 */

/** Bullish: rising trend line with up-right cue (Bloomberg/terminal-style). */
export function OutlookBullishIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M4 16 9 11 13 13 17 7 20 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M17 5h3v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

/** Neutral: sideways / range-bound (flat channel). */
export function OutlookNeutralIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M4 12h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M5 10.5 9 13.5 13 10.5 17 13.5 19 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        opacity="0.85"
      />
    </svg>
  );
}

/** Bearish: declining trend with down-right cue. */
export function OutlookBearishIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M4 8 9 13 13 11 17 17 20 19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M17 19h3v-3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

const OUTLOOK_ICON_MAP = {
  bullish: OutlookBullishIcon,
  neutral: OutlookNeutralIcon,
  bearish: OutlookBearishIcon
} as const;

export function OutlookIconFor({
  outlook,
  className
}: {
  outlook: AccountOutlook | null | undefined;
  className?: string;
}) {
  if (outlook !== "bullish" && outlook !== "neutral" && outlook !== "bearish") {
    return null;
  }
  const Cmp = OUTLOOK_ICON_MAP[outlook];
  return <Cmp className={className} />;
}

export function outlookIconClassForSlug(
  outlook: AccountOutlook | null | undefined
): string | undefined {
  if (outlook === "bullish") {
    return "text-[var(--xf-gain-green)]";
  }
  if (outlook === "bearish") {
    return "text-[var(--xf-danger-400)]";
  }
  if (outlook === "neutral") {
    return "text-[var(--xf-lightning-yellow)]";
  }
  return "text-[var(--xf-text-300)]";
}
