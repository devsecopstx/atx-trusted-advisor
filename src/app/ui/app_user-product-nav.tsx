import Link from "next/link";

import { isGlobalAdmin } from "@/modules/identity/authorization";

export type AppUserProductNavCurrent = "xchat" | "xcoach" | "xfinance" | "watchlist";

type AppUserProductNavProps = {
  current: AppUserProductNavCurrent;
  roles: string[];
};

const NAV: { id: AppUserProductNavCurrent; label: string; href: string }[] = [
  { id: "xchat", label: "xChat", href: "/xchat" },
  { id: "xcoach", label: "xCoach", href: "/xcoach" },
  { id: "xfinance", label: "Portfolio", href: "/xfinance" },
  { id: "watchlist", label: "Watchlist", href: "/watchlist" }
];

/**
 * Approved app_user accounts: xChat, xCoach, Portfolio (xFinance surface), Watchlist.
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
          Admin
        </Link>
      ) : null}
    </nav>
  );
}
