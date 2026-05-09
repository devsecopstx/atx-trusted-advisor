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

/**
 * xOptions rail / header — line-art rocket (~45° up-right toward +x), inspired by X Creator Studio nav
 * (capsule hull, porthole, fins, exhaust wisps). Slight viewBox scale so optical size matches Lucide 24×24 marks.
 */
export function XoptionsRocketIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <g transform="translate(12 12)">
        <g transform="rotate(42)">
          <g transform="scale(1.16)">
            <g
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              transform="translate(-12 -12)"
            >
              <path d="M12 4.75 L13.35 8.35 L12 7.15 L10.65 8.35 Z" />
              <path d="M10.65 8.35 Q12 8.85 13.35 8.35 L14.35 14.85 Q12 16.05 9.65 14.85 L10.65 8.35 Z" />
              <circle cx="12" cy="11.6" r="1.2" />
              <path d="M9.65 14.85 L7.85 17.85 M14.35 14.85 L16.15 17.85" />
              <path d="M10.2 15.9 Q8.9 18.2 8.35 20.25 M12 16.1 Q12 18.6 12 20.75 M13.8 15.9 Q15.1 18.2 15.65 20.25" />
            </g>
          </g>
        </g>
      </g>
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

/** Sidebar collapse affordance — panel narrows left. https://lucide.dev/icons/chevron-left */
export function LucideChevronLeftIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

/** Sidebar expand affordance. https://lucide.dev/icons/chevron-right */
export function LucideChevronRightIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

/** Settings / tenant admin hub shortcut rail. https://lucide.dev/icons/settings */
export function LucideSettingsIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

/** Compose / edit — pen on document (Lucide `square-pen`). https://lucide.dev/icons/square-pen */
/** Folder — workspace / attachments rail. https://lucide.dev/icons/folder */
export function LucideFolderIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.89l-.812-1.22A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

/** Broker CSV upload rail — matches workspace upload cue. https://lucide.dev/icons/upload */
export function LucideUploadIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M12 5v10m0 0l-3.5-3.5M12 15l3.5-3.5M5 19h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

/** Scheduled tasks / automation rail. https://lucide.dev/icons/clipboard-list */
export function LucideClipboardListIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path
        d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2v0z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M9 12h6M9 16h6M9 8h2" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </svg>
  );
}

/** Bulleted list — Example prompts rail / workspace shortcuts. https://lucide.dev/icons/list */
export function LucideListBulletsIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path d="M8 6h13" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path d="M8 12h13" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path d="M8 18h13" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
      <path d="M3 6h.01" stroke="currentColor" strokeLinecap="round" strokeWidth={2.25} />
      <path d="M3 12h.01" stroke="currentColor" strokeLinecap="round" strokeWidth={2.25} />
      <path d="M3 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth={2.25} />
    </svg>
  );
}

/** Session / account rail — https://lucide.dev/icons/log-out */
export function LucideLogOutIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M16 17l5-5-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
      <path d="M21 12H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
    </svg>
  );
}

/** Grok-style sign out: bracket on the right, arrow exiting left (workspace profile menu). */
export function WorkspaceSignOutIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <path d="M10 17 5 12l5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
      <path d="M15 12H5" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </svg>
  );
}

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

/** Workspace mobile/tablet drawer toggle — https://lucide.dev/icons/menu */
export function LucideMenuIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </svg>
  );
}

/** Close drawer / dismiss — https://lucide.dev/icons/x */
export function LucideXIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className} {...props}>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeWidth={1.75} />
    </svg>
  );
}
