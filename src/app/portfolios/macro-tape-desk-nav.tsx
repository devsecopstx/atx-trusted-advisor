"use client";

import Link from "next/link";

import { isPathAllowedByTenantUxRoutes } from "@/app/ui/tenant-ux-nav-visibility";

export type MacroTapeDeskNavProps = {
  visiblePathPrefixes?: string[];
  deskPortfolioId?: string | null;
};

export function MacroTapeDeskNav({ visiblePathPrefixes, deskPortfolioId }: MacroTapeDeskNavProps) {
  const pid = deskPortfolioId?.trim() || null;
  const q = (prefix: string) => (pid ? `${prefix}?portfolioId=${encodeURIComponent(pid)}` : prefix);

  const canNavigate = (href: string) =>
    !visiblePathPrefixes || isPathAllowedByTenantUxRoutes(href, visiblePathPrefixes);

  const navItems: Array<{ href: string; label: string }> = [];
  if (canNavigate("/watchlist")) {
    navItems.push({ href: q("/watchlist"), label: "Watchlist" });
  }
  if (canNavigate("/xoptions")) {
    navItems.push({ href: "/xoptions", label: "xOptions" });
  }
  if (canNavigate("/portfolio/alerts")) {
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
