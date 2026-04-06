"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { LucideHouseIcon, LucideMonitorIcon } from "@/app/ui/lucide-product-icons";
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

type NavDef = {
  id: Exclude<AppUserProductNavCurrent, null>;
  /** Shown in custom hover tooltip and as the link accessible name (`aria-label`). */
  hint: string;
  href: string;
  icon: ReactNode;
};

const NAV: NavDef[] = [
  {
    id: "xchat",
    hint: "Open xChat",
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
    hint: "Open xOptions — options chains & desk",
    href: "/xoptions",
    icon: (
      <IconWrap>
        <LucideHouseIcon />
      </IconWrap>
    )
  },
  {
    id: "portfolio",
    hint: "Manage portfolios",
    href: "/portfolios",
    icon: (
      <IconWrap>
        <LucideMonitorIcon />
      </IconWrap>
    )
  },
  {
    id: "watchlist",
    hint: "Manage watchlist",
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
 * Product row: xChat, xOptions (Lucide-style house SVG), Portfolio (monitor / desk) → **`/portfolios`**, Watchlist.
 * No billing or Hub icon — billing is Account menu / `/account/billing`; admins reach **`/admin`** from bookmarks or admin shell nav.
 * Legacy **`/xstrategybuilder`** redirects to **`/xoptions`**.
 */
export function AppUserProductNav({ current }: AppUserProductNavProps) {
  return (
    <nav className="xchat-header-nav" aria-label="Product">
      {NAV.map((item) => (
        <XfHoverHint key={item.id} hint={item.hint}>
          <Link
            aria-current={item.id === current ? "page" : undefined}
            aria-label={item.hint}
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
