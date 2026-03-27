import Link from "next/link";
import type { ReactNode } from "react";

import { APP_VERSION_LABEL } from "@/lib/app-version";

import { USER_PRODUCT_WHITELABEL_SUBLINE } from "./product-brand-constants";

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
};

export function GlobalFooter({ subline }: GlobalFooterProps) {
  const year = new Date().getFullYear();
  const effectiveSubline = subline ?? (
    <>
      <span className="app-footer-disclaimer-strong">Not financial advice</span> — options involve risk of loss.
      For approved users only.
    </>
  );

  return (
    <footer className="app-footer">
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
            <span className="app-footer-copy">© {year} atx Trusted Advisor</span>
            <span className="app-footer-whitelabel">{USER_PRODUCT_WHITELABEL_SUBLINE}</span>
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
