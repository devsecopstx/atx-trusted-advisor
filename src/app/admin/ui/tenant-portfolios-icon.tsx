import type { SVGProps } from "react";

/**
 * Stacked “books” mark for tenant portfolio hub + `/admin/portfolios` — distinct from the single-card `portfolio` icon used for Brokers.
 */
export function TenantPortfoliosIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M5 5.5h3v13H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
      <path d="M8 5.5h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8" />
      <path d="M11 9.5h7M11 12.5h7M11 15.5h4.5" />
    </svg>
  );
}
