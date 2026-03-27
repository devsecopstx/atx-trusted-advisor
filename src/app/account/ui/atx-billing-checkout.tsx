"use client";

import { useCallback, useState } from "react";

import type { AtxBillingPlanId } from "@/lib/atx-billing-plans";

type AtxBillingCheckoutProps = {
  planId: AtxBillingPlanId;
  checkoutReady: boolean;
  label?: string;
};

export function AtxBillingCheckoutButton({
  planId,
  checkoutReady,
  label = "Subscribe with Stripe"
}: AtxBillingCheckoutProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    if (!checkoutReady) {
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; detail?: string };
      if (!res.ok) {
        setStatus(data.error ?? data.detail ?? `Checkout failed (${res.status})`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setStatus("No redirect URL returned");
    } catch {
      setStatus("Network error");
    } finally {
      setLoading(false);
    }
  }, [checkoutReady, planId]);

  return (
    <div className="billing-card__cta">
      <button
        type="button"
        className="cta cta-primary"
        style={{ width: "100%" }}
        disabled={!checkoutReady || loading}
        onClick={() => void start()}
      >
        {loading ? "Redirecting…" : label}
      </button>
      {status ? (
        <p className="status-text status-error" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
          {status}
        </p>
      ) : null}
    </div>
  );
}
