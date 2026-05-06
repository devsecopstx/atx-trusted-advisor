"use client";

import Link from "next/link";

const TEASERS: { href: string; label: string }[] = [
  { href: "/xchat#xchat-composer", label: "Portfolio concentration review" },
  { href: "/xchat#xchat-composer", label: "Wheel / covered-call scan" }
];

export function XchatFooterWorkspaceTeasers() {
  return (
    <nav aria-label="Popular workspace prompts" className="xchat-footer-teasers">
      <span className="xchat-footer-teasers__eyebrow">Try in xChat</span>
      <ul className="xchat-footer-teasers__list">
        {TEASERS.map((t) => (
          <li key={t.label}>
            <Link className="xchat-footer-teasers__link" href={t.href}>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
