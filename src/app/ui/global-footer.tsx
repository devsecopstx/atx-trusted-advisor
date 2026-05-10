import Link from "next/link";
import type { ReactNode } from "react";

import { APP_VERSION_LABEL } from "@/lib/app-version";
import { EDUCATIONAL_ONLY_SHORT } from "@/lib/legal-disclaimers";

const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: "/legal/imprint", label: "Imprint" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/security", label: "Security" },
  { href: "/legal/vulnerability", label: "Report a vulnerability" }
];

type GlobalFooterProps = {
  /** Optional override for the shared disclaimer row. */
  subline?: ReactNode;
  /** Extra classes (e.g. portfolios shell `sticky bottom-0 z-50`). */
  className?: string;
};

export function GlobalFooter({ subline, className }: GlobalFooterProps) {
  const year = new Date().getFullYear();
  const effectiveSubline = subline ?? <>{EDUCATIONAL_ONLY_SHORT}</>;

  const footerClass = ["app-footer", className?.trim()].filter(Boolean).join(" ");

  return (
    <footer className={footerClass}>
      <div className="app-footer-bar flex items-center text-xs text-slate-500">
        <nav className="app-footer-nav flex-none" aria-label="Legal and security">
          {LEGAL_LINKS.map((item, index) => (
            <span className="app-footer-nav-item" key={item.href}>
              {index > 0 ? (
                <span aria-hidden className="app-footer-sep">
                  |
                </span>
              ) : null}
              <Link className="app-footer-link" href={item.href}>
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="app-footer-subline-stack app-footer-subline flex-1 text-center" aria-label="Disclaimer">
          {effectiveSubline}
        </div>
        <div className="app-footer-meta flex-none" aria-label="Copyright">
          <span className="app-footer-brand-stack">
            <span className="app-footer-copy">© {year} aTx Trusted Advisory</span>
          </span>
          <span aria-hidden className="app-footer-sep">
            |
          </span>
          <span className="app-footer-rights">All rights reserved.</span>
          <span aria-hidden className="app-footer-sep">
            |
          </span>
          <span className="app-footer-version">{APP_VERSION_LABEL}</span>
        </div>
      </div>
    </footer>
  );
}
