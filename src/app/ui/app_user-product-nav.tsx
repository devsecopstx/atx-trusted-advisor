"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { XfHoverHint } from "@/app/ui/xf-hover-hint";

export type AppUserProductNavCurrent =
  | "xchat"
  | "xstrategybuilder"
  | "portfolio"
  | "watchlist"
  | "account";

type AppUserProductNavProps = {
  current: AppUserProductNavCurrent;
};

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="xchat-header-icon-link__glyph">
      {children}
    </span>
  );
}

const NAV: { id: AppUserProductNavCurrent; label: string; href: string; icon: ReactNode }[] = [
  {
    id: "xchat",
    label: "xChat",
    href: "/xchat",
    icon: (
      <IconWrap>
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M4 4h12v8H7l-3 3V4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </IconWrap>
    )
  },
  {
    id: "xstrategybuilder",
    label: "xStrategyBuilder",
    href: "/xstrategybuilder",
    icon: (
      <IconWrap>
        <Image
          alt=""
          aria-hidden
          className="xchat-header-icon-link__glyph-img xstrategybuilder-nav-icon-img"
          height={20}
          src="/branding/xstrategybuilder-topnav-icon-transparent.png"
          width={20}
        />
      </IconWrap>
    )
  },
  {
    id: "portfolio",
    label: "Portfolio",
    href: "/portfolio",
    icon: (
      <IconWrap>
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M3 15.5h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
          <path
            d="M4.5 12.5l3.5-4 3 2.5L15.5 5.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </IconWrap>
    )
  },
  {
    id: "watchlist",
    label: "Watchlist",
    href: "/watchlist",
    icon: (
      <IconWrap>
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M10 3l2.1 4.26L17 8l-3.5 3.4.83 4.86L10 14.2 5.67 16.26l.83-4.86L3 8l4.9-.74L10 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
        </svg>
      </IconWrap>
    )
  },
  {
    id: "account",
    label: "Account & billing",
    href: "/account/billing",
    icon: (
      <IconWrap>
        <svg viewBox="0 0 20 20" fill="none">
          <path
            d="M4 5.5h12v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 014 14.5v-9z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
          <path d="M4 7.5h12" stroke="currentColor" strokeWidth="1.4" />
          <path d="M7 12h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
        </svg>
      </IconWrap>
    )
  }
];

/**
 * Approved app_user accounts: xChat, xStrategyBuilder, Portfolio (`/portfolio`), Watchlist, Account & billing (`/account/billing`).
 * **Hub** (`/admin`) is shown for every approved session; non-admins are redirected to `/xchat` if they lack `global_admin`.
 */
export function AppUserProductNav({ current }: AppUserProductNavProps) {
  return (
    <nav className="xchat-header-nav" aria-label="Product">
      {NAV.map((item) => (
        <XfHoverHint key={item.id} hint={item.label}>
          <Link
            aria-current={item.id === current ? "page" : undefined}
            aria-label={item.label}
            className={`xchat-header-icon-link${item.id === current ? " xchat-header-icon-link--active" : ""}`}
            href={item.href}
          >
            {item.icon}
          </Link>
        </XfHoverHint>
      ))}
      <XfHoverHint hint="Hub">
        <Link aria-label="Hub" className="xchat-header-icon-link" href="/admin">
        <IconWrap>
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
          </svg>
        </IconWrap>
        </Link>
      </XfHoverHint>
    </nav>
  );
}
