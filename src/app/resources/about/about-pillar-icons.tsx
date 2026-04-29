import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Eight simple line icons for educational pillar cards (theme hints; not category logos). */
export function AboutPillarIcon({ pillarIndex, className, ...props }: IconProps & { pillarIndex: number }) {
  const idx = ((pillarIndex % 8) + 8) % 8;
  const cn = className?.trim() ?? "";
  const merged = ["resources-about-pillar-card__svg", cn].filter(Boolean).join(" ");

  switch (idx) {
    case 0:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <path
            d="M4 19.5A2.5 2.5 0 016.5 17H20"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
          <path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
        </svg>
      );
    case 1:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <path
            d="M12 3l1.8 3.6L18 8l-4.2.9L12 12l-1.8-4.1L6 8l4.2-1.4L12 3z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
          <path
            d="M5 19l2.2-4.4M19 19l-2.2-4.4M9 21l1-2M15 21l-1-2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={1.65}
          />
        </svg>
      );
    case 2:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
        </svg>
      );
    case 3:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <path d="M3 3v18h18" stroke="currentColor" strokeLinecap="round" strokeWidth={1.65} />
          <path
            d="M7 16l4-4 4 4 5-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
        </svg>
      );
    case 4:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <path
            d="M12.83 2.18a2 2 0 00-1.66 0L2 6.08l9 3.9 9-3.9-4.17-1.8a2 2 0 00-1.66 0z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
          <path
            d="M2 6.08v11.84l9 3.9 9-3.9V6.08"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
          <path d="M12 22V12" stroke="currentColor" strokeLinecap="round" strokeWidth={1.65} />
        </svg>
      );
    case 5:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <rect height="18" rx="2" stroke="currentColor" strokeWidth={1.65} width="8" x="3" y="3" />
          <rect height="8" rx="1" stroke="currentColor" strokeWidth={1.65} width="8" x="13" y="3" />
          <rect height="8" rx="1" stroke="currentColor" strokeWidth={1.65} width="8" x="13" y="13" />
        </svg>
      );
    case 6:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <path
            d="M12 3v18M3 12h18"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={1.65}
          />
          <circle cx="12" cy="12" fill="none" r="3" stroke="currentColor" strokeWidth={1.65} />
          <path
            d="M12 5v2M12 17v2M5 12H7M17 12h2"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={1.65}
          />
        </svg>
      );
    default:
      return (
        <svg aria-hidden className={merged} fill="none" viewBox="0 0 24 24" {...props}>
          <path
            d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={1.65}
          />
          <path
            d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth={1.65}
          />
        </svg>
      );
  }
}
