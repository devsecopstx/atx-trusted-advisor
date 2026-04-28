"use client";

import { useEffect, useMemo, useState } from "react";

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

export function BillingAccessStateBanner({ className }: { className?: string }) {
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div
      className={className}
      style={{
        marginBottom: "0.9rem",
        borderRadius: "0.5rem",
        padding: "0.6rem 0.8rem",
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text
      }}
      role="status"
      aria-live="polite"
    >
      <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, lineHeight: 1.3 }}>{content}</p>
      <p style={{ margin: "0.2rem 0 0", fontSize: "0.74rem", lineHeight: 1.35, opacity: 0.95 }}>
        {detail}
      </p>
    </div>
  );
}

