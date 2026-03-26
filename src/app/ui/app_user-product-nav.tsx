import Link from "next/link";
import type { ReactNode } from "react";

export type AppUserProductNavCurrent =
  | "xchat"
  | "xstrategybuilder"
  | "portfolio"
  | "watchlist";

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
        <svg viewBox="0 0 20 20" fill="none">
          <path d="M3 15h14M5 12l3-3 3 2 4-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="8" cy="9" r="1" fill="currentColor" />
          <circle cx="11" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="6" r="1" fill="currentColor" />
        </svg>
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
          <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 8h6M7 11h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
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
 * Approved app_user accounts: xChat, xStrategyBuilder, Portfolio (`/portfolio`), Watchlist.
 * **Hub** (`/admin`) is shown for every approved session; non-admins are redirected to `/xchat` if they lack `global_admin`.
 */
export function AppUserProductNav({ current }: AppUserProductNavProps) {
  return (
    <nav className="xchat-header-nav" aria-label="Product">
      {NAV.map((item) => (
        <Link
          key={item.id}
          aria-current={item.id === current ? "page" : undefined}
          aria-label={item.label}
          className={`xchat-header-icon-link${item.id === current ? " xchat-header-icon-link--active" : ""}`}
          href={item.href}
          title={item.label}
        >
          {item.icon}
        </Link>
      ))}
      <Link aria-label="Hub" className="xchat-header-icon-link" href="/admin" title="Hub">
        <IconWrap>
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M4 5h5v5H4V5Zm7 0h5v5h-5V5ZM4 12h5v3H4v-3Zm7 0h5v3h-5v-3Z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </IconWrap>
      </Link>
    </nav>
  );
}
