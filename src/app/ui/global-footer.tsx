import Link from "next/link";
import type { ReactNode } from "react";

import { APP_VERSION_LABEL } from "@/lib/app-version";
import { EDUCATIONAL_ONLY_FULL } from "@/lib/legal-disclaimers";

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
  const effectiveSubline = subline ?? <>{EDUCATIONAL_ONLY_FULL}</>;

  const footerClass = ["app-footer", className?.trim()].filter(Boolean).join(" ");

  return (
    <footer className={footerClass}>
      <div className="app-footer-bar">
        <nav className="app-footer-nav" aria-label="Legal and security">
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
        <div className="app-footer-meta" aria-label="Copyright">
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
      <div className="app-footer-subline-stack">
        <div className="app-footer-subline">{effectiveSubline}</div>
      </div>
    </footer>
  );
}
