"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { billingAccessStateDetail } from "@/lib/billing-access-copy";

const SESSION_DISMISS_KEY = "xf_trial_billing_notice_dismissed";

const NOTICE_STATES = new Set([
  "trial_active",
  "trial_expired",
  "approved_unpaid",
  "past_due",
  "canceled"
]);

type BillingAccessApiResponse = {
  data?: {
    billingState?: string;
    trialDaysRemaining?: number | null;
    redirectPath?: string;
  };
};

/**
 * Dismissible session popup: trial / unpaid access until billing is completed.
 * Mount once on shared product chrome (e.g. WorkspaceProductSidebar).
 */
export function TrialBillingNoticeModal() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [billingHref, setBillingHref] = useState("/account/billing");

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    try {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") {
        return;
      }
    } catch {
      /* ignore */
    }

    void (async () => {
      try {
        const res = await fetch("/api/internal/authz/billing-access", {
          credentials: "include",
          cache: "no-store"
        });
        if (!res.ok || cancelled) {
          return;
        }
        const payload = (await res.json()) as BillingAccessApiResponse;
        const state = payload.data?.billingState ?? null;
        if (!state || !NOTICE_STATES.has(state)) {
          return;
        }
        const copy = billingAccessStateDetail({
          state,
          trialDaysRemaining: payload.data?.trialDaysRemaining
        });
        if (cancelled) {
          return;
        }
        setDetail(copy.detail);
        setBillingHref(payload.data?.redirectPath?.trim() || "/account/billing");
        setOpen(true);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        dismiss();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open || !detail) {
    return null;
  }

  return (
    <div className="xchat-disclaimer-modal-root">
      <button
        aria-label="Dismiss trial notice"
        className="xchat-disclaimer-modal-backdrop"
        type="button"
        onClick={dismiss}
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="xchat-disclaimer-modal"
        role="dialog"
      >
        <h2 className="xchat-disclaimer-modal__title" id={titleId}>
          Trial access until billing
        </h2>
        <p className="xchat-disclaimer-modal__body">{detail}</p>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] px-3 py-2 text-sm text-[var(--xf-text-200)]"
            type="button"
            onClick={dismiss}
          >
            Not now
          </button>
          <Link
            className="xchat-disclaimer-modal__confirm inline-flex no-underline"
            href={billingHref}
            onClick={dismiss}
          >
            Go to billing
          </Link>
        </div>
      </div>
    </div>
  );
}
