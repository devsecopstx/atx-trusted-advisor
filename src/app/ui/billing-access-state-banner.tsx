"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";

import { billingAccessStateDetail, type BillingAccessTone } from "@/lib/billing-access-copy";
import {
    clearOverrideActiveDismissMarkers,
    readOverrideActiveDismissed,
    writeOverrideActiveDismissed
} from "@/lib/billing-access-dismiss";

const MOBILE_DISMISS_MQ = "(max-width: 767px)";
const MOBILE_DISMISS_STORAGE_PREFIX = "xf_xchat_billing_banner_dismissed:";

function subscribeMobileDismissMq(cb: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const mq = window.matchMedia(MOBILE_DISMISS_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMobileDismissMqSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_DISMISS_MQ).matches;
}

type BillingAccessApiResponse = {
  data?: {
    billingState?: string;
    entitled?: boolean;
    subscriptionActive?: boolean;
    productAccessAllowed?: boolean;
    requiresBilling?: boolean;
    redirectPath?: string;
  };
};

const toneStyles: Record<BillingAccessTone, { bg: string; border: string; text: string }> = {
  ok: {
    bg: "color-mix(in srgb, var(--xf-gain-green) 10%, transparent)",
    border: "color-mix(in srgb, var(--xf-gain-green) 28%, transparent)",
    text: "var(--xf-text-100)"
  },
  warn: {
    bg: "color-mix(in srgb, var(--xf-lightning-yellow) 12%, transparent)",
    border: "color-mix(in srgb, var(--xf-lightning-yellow) 30%, transparent)",
    text: "var(--xf-text-100)"
  },
  bad: {
    bg: "color-mix(in srgb, var(--xf-loss-red, #f87171) 12%, transparent)",
    border: "color-mix(in srgb, var(--xf-loss-red, #f87171) 30%, transparent)",
    text: "var(--xf-text-100)"
  },
  muted: {
    bg: "color-mix(in srgb, var(--xf-text-400) 10%, transparent)",
    border: "color-mix(in srgb, var(--xf-text-100) 12%, transparent)",
    text: "var(--xf-text-300)"
  }
};

export type BillingAccessStateBannerProps = {
  className?: string;
  /**
   * Signed-in email (or stable account id) so override-banner dismiss survives logouts/logins per user.
   */
  persistentDismissIdentity?: string | null;
  /**
   * Session-wide dismiss (sessionStorage) on small viewports only — primary chrome clearance.
   */
  dismissSessionKey?: string;
};

export function BillingAccessStateBanner({
  className,
  dismissSessionKey,
  persistentDismissIdentity = null
}: BillingAccessStateBannerProps) {
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientDismissed, setClientDismissed] = useState(false);
  const [overrideActiveDismissed, setOverrideActiveDismissed] = useState(false);

  const dismissStorageKey =
    dismissSessionKey != null && dismissSessionKey.trim().length > 0
      ? `${MOBILE_DISMISS_STORAGE_PREFIX}${dismissSessionKey.trim()}`
      : null;

  const mobileDismissLayout = useSyncExternalStore(
    subscribeMobileDismissMq,
    getMobileDismissMqSnapshot,
    () => false
  );

  useEffect(() => {
    if (!dismissStorageKey) {
      return;
    }
    try {
      if (sessionStorage.getItem(dismissStorageKey) === "1") {
        setClientDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, [dismissStorageKey]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (state !== "override_active") {
      clearOverrideActiveDismissMarkers(persistentDismissIdentity);
      setOverrideActiveDismissed(false);
      return;
    }
    setOverrideActiveDismissed(readOverrideActiveDismissed(persistentDismissIdentity));
  }, [state, persistentDismissIdentity, loading]);

  useEffect(() => {
    let active = true;
    async function loadState() {
      try {
        const response = await fetch("/api/internal/authz/billing-access", {
          credentials: "include",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as BillingAccessApiResponse;
        if (!response.ok) {
          throw new Error(`Billing state request failed (${response.status})`);
        }
        if (!active) {
          return;
        }
        setState(payload.data?.billingState?.trim() || null);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load billing state");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadState();
    return () => {
      active = false;
    };
  }, []);

  const copy = useMemo(() => billingAccessStateDetail(state), [state]);
  const tone = error ? toneStyles.muted : toneStyles[copy.tone];
  const content = loading
    ? "Billing state: loading..."
    : error
      ? "Billing state: unavailable."
      : `Billing state: ${state ?? "unknown"}`;
  const detail = loading
    ? "Checking current entitlement."
    : error
      ? error
      : copy.detail;

  const showDismissOverrideActive =
    state === "override_active" && !loading && !error && !overrideActiveDismissed;

  const showDismissMobileSession =
    Boolean(dismissStorageKey) && mobileDismissLayout && !loading && !clientDismissed;

  const showDismissButton = showDismissOverrideActive || showDismissMobileSession;

  if (clientDismissed) {
    return null;
  }

  if (state === "override_active" && overrideActiveDismissed) {
    return null;
  }

  return (
    <div
      className={[
        "billing-access-state-banner",
        showDismissButton ? "billing-access-state-banner--dismissible" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      data-billing-tone={error ? "muted" : copy.tone}
      role="status"
      aria-live="polite"
      style={
        {
          ["--billing-banner-bg" as string]: tone.bg,
          ["--billing-banner-border" as string]: tone.border,
          ["--billing-banner-text" as string]: tone.text
        } as CSSProperties
      }
    >
      {showDismissButton ? (
        <button
          aria-label={
            state === "override_active"
              ? "Dismiss admin billing override notice — stays hidden on future visits until this access mode ends"
              : "Dismiss billing notice for this session"
          }
          className="billing-access-state-banner__dismiss"
          type="button"
          onClick={() => {
            if (state === "override_active") {
              writeOverrideActiveDismissed(persistentDismissIdentity);
              setOverrideActiveDismissed(true);
              return;
            }
            try {
              if (dismissStorageKey) {
                sessionStorage.setItem(dismissStorageKey, "1");
              }
            } catch {
              /* ignore */
            }
            setClientDismissed(true);
          }}
        >
          ×
        </button>
      ) : null}
      <p className="billing-access-state-banner__title">{content}</p>
      <p className="billing-access-state-banner__detail">{detail}</p>
    </div>
  );
}
