"use client";

import { useState } from "react";

const STORAGE_KEY = "xf_xoptions_disclaimer_ack_v1";

export function XoptionsDisclaimerModal() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return localStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });

  function acknowledge() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="xoptions-disclaimer-modal fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="xoptions-disclaimer-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "color-mix(in srgb, var(--xf-bg-900) 78%, transparent)" }}
        aria-label="Dismiss disclaimer overlay"
        onClick={acknowledge}
      />
      <div className="relative z-[81] w-full max-w-lg rounded-[var(--xf-radius-md)] border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--xf-xoptions-surface)_96%,var(--xf-bg-900))] p-5 shadow-[var(--xf-shadow-card)]">
        <h2
          id="xoptions-disclaimer-title"
          className="m-0 text-base font-semibold tracking-tight text-[var(--xf-text-200)]"
        >
          Important notice
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--xf-text-300)]">
          Not financial, tax, or legal advice. Options involve substantial risk of loss. Past performance is not
          indicative of future results. Chain prices and greeks are illustrative and may be delayed. Consult your
          advisor before trading.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="xoptions-next-btn xoptions-print-hide"
            onClick={acknowledge}
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
