import type { SVGProps } from "react";

/**
 * Stroke icons from Lucide (lucide-static, ISC) — product nav + workspace rail.
 * https://lucide.dev/icons/book-open · https://lucide.dev/icons/house · https://lucide.dev/icons/monitor
 */
export function LucideBookOpenIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path d="M12 7v14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
      <path
        d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

/** Workstation / books overview rail — distinct from Resources (open book / reading list). https://lucide.dev/icons/monitor */
export function LucideMonitorIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <rect
        height="14"
        rx="2"
        ry="2"
        width="20"
        x="2"
        y="3"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <path d="M8 21h8" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path d="M12 17v4" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </svg>
  );
}

export function LucideHouseIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path
        d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

/** Compose / edit — pen on document (Lucide `square-pen`). https://lucide.dev/icons/square-pen */
export function LucideSquarePenIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path
        d="M18.375 2.625a1 1 0 0 1 3 3l-9.415 9.415a1 1 0 0 1-.294.196v3.01a.5.5 0 0 1-.5.5H9.5a.5.5 0 0 1-.5-.5v-1.586a1 1 0 0 1 .196-.294L18.375 2.625z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}
