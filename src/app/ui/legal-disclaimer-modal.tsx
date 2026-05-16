"use client";

import { useEffect, useId } from "react";

import Link from "next/link";

import { EDUCATIONAL_ONLY_FULL } from "@/lib/legal-disclaimers";

const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/imprint", label: "Imprint" }
];

type LegalDisclaimerModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LegalDisclaimerModal({ open, onClose }: LegalDisclaimerModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="xchat-disclaimer-modal-root">
      <button
        aria-label="Close disclaimer"
        className="xchat-disclaimer-modal-backdrop"
        type="button"
        onClick={onClose}
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="xchat-disclaimer-modal"
        role="dialog"
      >
        <h2 className="xchat-disclaimer-modal__title" id={titleId}>
          Legal & disclaimer
        </h2>
        <p className="xchat-disclaimer-modal__body">{EDUCATIONAL_ONLY_FULL}</p>
        <nav aria-label="Legal documents" className="xchat-disclaimer-modal__links">
          {LEGAL_LINKS.map((item, i) => (
            <span className="xchat-disclaimer-modal__link-wrap" key={item.href}>
              {i > 0 ? (
                <span aria-hidden className="xchat-disclaimer-modal__sep">
                  ·
                </span>
              ) : null}
              <Link className="xchat-disclaimer-modal__link" href={item.href} onClick={onClose}>
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
        <button className="xchat-disclaimer-modal__confirm" type="button" onClick={onClose}>
          I understand
        </button>
      </div>
    </div>
  );
}
