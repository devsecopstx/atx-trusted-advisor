"use client";

import { useCallback, useState } from "react";

type Props = {
  checkoutReady: boolean;
  hasStripeCustomer: boolean;
};

export function AtxBillingPortalButton({ checkoutReady, hasStripeCustomer }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const openPortal = useCallback(async () => {
    if (!checkoutReady || !hasStripeCustomer) {
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/billing/portal-session", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; hint?: string };
      if (!res.ok) {
        setStatus(data.error ?? data.hint ?? `Portal failed (${res.status})`);
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
  }, [checkoutReady, hasStripeCustomer]);

  if (!hasStripeCustomer) {
    return null;
  }

  return (
    <div className="billing-portal-cta">
      <button
        type="button"
        className="cta cta-secondary"
        disabled={!checkoutReady || loading}
        onClick={() => void openPortal()}
      >
        {loading ? "Opening…" : "Manage subscription & payment method"}
      </button>
      {status ? (
        <p className="status-text status-error billing-portal-cta__status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
