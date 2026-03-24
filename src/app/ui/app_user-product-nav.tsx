import Link from "next/link";

import { isGlobalAdmin } from "@/modules/identity/authorization";

export type AppUserProductNavCurrent =
  | "xchat"
  | "xstrategybuilder"
  | "portfolio"
  | "watchlist";

type AppUserProductNavProps = {
  current: AppUserProductNavCurrent;
  roles: string[];
};

const NAV: { id: AppUserProductNavCurrent; label: string; href: string }[] = [
  { id: "xchat", label: "xChat", href: "/xchat" },
  { id: "xstrategybuilder", label: "xStrategyBuilder", href: "/xstrategybuilder" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  { id: "watchlist", label: "Watchlist", href: "/watchlist" }
];

/**
 * Approved app_user accounts: xChat, xStrategyBuilder, Portfolio (`/portfolio`), Watchlist.
 * `global_admin` also gets Admin (console). Not shown for guests / unapproved sessions.
 */
export function AppUserProductNav({ current, roles }: AppUserProductNavProps) {
  const admin = isGlobalAdmin(roles);

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
      {admin ? (
        <Link className="xchat-header-link" href="/admin">
          Admin Console
        </Link>
      ) : null}
    </nav>
  );
}
