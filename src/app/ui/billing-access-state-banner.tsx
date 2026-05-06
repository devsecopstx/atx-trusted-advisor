"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";

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

type BannerTone = "ok" | "warn" | "bad" | "muted";

const toneStyles: Record<BannerTone, { bg: string; border: string; text: string }> = {
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

function resolveStateCopy(state: string | null): { tone: BannerTone; detail: string } {
  switch (state) {
    case "active":
      return {
        tone: "ok",
        detail: "Subscription is active."
      };
    case "override_active":
      return {
        tone: "warn",
        detail: "Admin billing override is active."
      };
    case "approved_unpaid":
      return {
        tone: "warn",
        detail:
          "Approved account — full workspace access until you add a subscription. This notice goes away once billing is active."
      };
    case "past_due":
      return {
        tone: "bad",
        detail: "Subscription is past due."
      };
    case "canceled":
      return {
        tone: "bad",
        detail: "Subscription is canceled."
      };
    case "pending":
      return {
        tone: "muted",
        detail: "Access is pending approval."
      };
    default:
      return {
        tone: "muted",
        detail: "Billing status is unavailable."
      };
  }
}

export type BillingAccessStateBannerProps = {
  className?: string;
  /**
   * When set, session-wide dismiss (sessionStorage) is offered on small viewports only.
   * Avoids pushing primary workspace chrome (e.g. xChat composer) below the fold on phones.
   */
  dismissSessionKey?: string;
};

export function BillingAccessStateBanner({ className, dismissSessionKey }: BillingAccessStateBannerProps) {
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientDismissed, setClientDismissed] = useState(false);

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

  const copy = useMemo(() => resolveStateCopy(state), [state]);
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

  const showDismiss =
    Boolean(dismissStorageKey) && mobileDismissLayout && !loading && !clientDismissed;

  if (clientDismissed) {
    return null;
  }

  return (
    <div
      className={["billing-access-state-banner", showDismiss ? "billing-access-state-banner--dismissible" : "", className]
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
      {showDismiss ? (
        <button
          aria-label="Dismiss billing notice for this session"
          className="billing-access-state-banner__dismiss"
          type="button"
          onClick={() => {
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

