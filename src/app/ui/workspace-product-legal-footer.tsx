"use client";

import { useState } from "react";

import Link from "next/link";

import { LegalDisclaimerModal } from "@/app/ui/legal-disclaimer-modal";
import { APP_VERSION_LABEL } from "@/lib/app-version";

const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: "/legal/imprint", label: "Imprint" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/security", label: "Security" },
  { href: "/legal/vulnerability", label: "Report a vulnerability" }
];

/**
 * Compact legal row for workspace-product shells (watchlist, portfolio, xOptions, xChat).
 * Full educational disclaimer opens in {@link LegalDisclaimerModal}.
 */
export function WorkspaceProductLegalFooter() {
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <footer className="xchat-main-footer">
      <LegalDisclaimerModal onClose={() => setDisclaimerOpen(false)} open={disclaimerOpen} />
      <div className="xchat-main-footer__row">
        <nav aria-label="Legal and security" className="xchat-main-footer__nav">
          {LEGAL_LINKS.map((item, index) => (
            <span className="xchat-main-footer__nav-item" key={item.href}>
              {index > 0 ? (
                <span aria-hidden className="xchat-main-footer__sep">
                  |
                </span>
              ) : null}
              <Link className="xchat-main-footer__link" href={item.href}>
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
        <button
          className="xchat-main-footer__disclosure"
          type="button"
          onClick={() => setDisclaimerOpen(true)}
        >
          Legal & disclaimer
        </button>
        <div aria-label="Copyright" className="xchat-main-footer__meta">
          <span className="xchat-main-footer__copy">© {year}</span>
          <span aria-hidden className="xchat-main-footer__sep">
            |
          </span>
          <span className="xchat-main-footer__version">{APP_VERSION_LABEL}</span>
        </div>
      </div>
    </footer>
  );
}
