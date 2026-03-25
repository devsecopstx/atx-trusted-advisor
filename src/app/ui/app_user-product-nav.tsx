import Link from "next/link";

export type AppUserProductNavCurrent =
  | "xchat"
  | "xstrategybuilder"
  | "portfolio"
  | "watchlist";

type AppUserProductNavProps = {
  current: AppUserProductNavCurrent;
};

const NAV: { id: AppUserProductNavCurrent; label: string; href: string }[] = [
  { id: "xchat", label: "xChat", href: "/xchat" },
  { id: "xstrategybuilder", label: "xStrategyBuilder", href: "/xstrategybuilder" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  { id: "watchlist", label: "Watchlist", href: "/watchlist" }
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
          className={item.id === current ? "xchat-header-cta" : "xchat-header-link"}
          href={item.href}
        >
          {item.label}
        </Link>
      ))}
      <Link className="xchat-header-link" href="/admin">
        Hub
      </Link>
    </nav>
  );
}
