"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { XfHoverHint } from "@/app/ui/xf-hover-hint";

/** Which product icon is active; use `null` on secondary surfaces (e.g. `/account/billing`) so none are highlighted. */
export type AppUserProductNavCurrent = "xchat" | "xoptions" | "portfolio" | "watchlist" | null;

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

const NAV: { id: Exclude<AppUserProductNavCurrent, null>; label: string; href: string; icon: ReactNode }[] = [
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
    id: "xoptions",
    label: "xOptions",
    href: "/xoptions",
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
    href: "/portfolios",
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
  }
];

/**
 * Product row: xChat, **xOptions** (legacy xStrategyBuilder PNG glyph), Portfolio → **`/portfolios`**, Watchlist.
 * No billing or Hub icon — billing is Account menu / `/account/billing`; admins reach **`/admin`** from bookmarks or admin shell nav.
 * Legacy **`/xstrategybuilder`** redirects to **`/xoptions`**.
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
    </nav>
  );
}
