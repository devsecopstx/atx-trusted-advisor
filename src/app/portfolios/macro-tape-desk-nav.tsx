"use client";

import Link from "next/link";

export type MacroTapeDeskNavProps = {
  visiblePathPrefixes?: string[];
  deskPortfolioId?: string | null;
};

export function MacroTapeDeskNav({ visiblePathPrefixes, deskPortfolioId }: MacroTapeDeskNavProps) {
  const pid = deskPortfolioId?.trim() || null;
  const q = (prefix: string) => (pid ? `${prefix}?portfolioId=${encodeURIComponent(pid)}` : prefix);

  const isPathVisible = (pathPrefix: string) =>
    pathPrefix === "/resources" ||
    !visiblePathPrefixes ||
    visiblePathPrefixes.some((allowed) => allowed === pathPrefix);

  const navItems: Array<{ href: string; label: string }> = [];
  if (isPathVisible("/watchlist")) {
    navItems.push({ href: q("/watchlist"), label: "Watchlist" });
  }
  if (isPathVisible("/xoptions")) {
    navItems.push({ href: "/xoptions", label: "xOptions" });
  }
  if (isPathVisible("/portfolio")) {
    navItems.push({ href: q("/portfolio/alerts"), label: "Alerts" });
  }

  if (navItems.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Desk shortcuts" className="portfolios-macro-tape__nav">
      {navItems.map((item, i) => (
        <span className="portfolios-macro-tape__nav-cell" key={item.href}>
          {i > 0 ? <span aria-hidden className="portfolios-macro-tape__nav-sep" /> : null}
          <Link className="portfolios-macro-tape__nav-link" href={item.href}>
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
