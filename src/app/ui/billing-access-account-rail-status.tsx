"use client";

import { useEffect, useMemo, useState } from "react";

import { billingAccessStateDetail } from "@/lib/billing-access-copy";

type BillingAccessApiResponse = {
  data?: {
    billingState?: string;
  };
};

export function BillingAccessAccountRailStatus() {
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
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
        setError(null);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load billing state");
        setState(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const copy = useMemo(() => billingAccessStateDetail(error ? null : state), [state, error]);

  return (
    <div
      className="app-user-rail-account-panel__billing"
      data-billing-tone={error ? "muted" : copy.tone}
    >
      <div className="app-user-rail-account-panel__billing-row">
        <span className="app-user-rail-account-panel__meta-k">Billing status</span>
        <span className="app-user-rail-account-panel__billing-value">
          {loading ? "Loading…" : error ? error : copy.detail}
        </span>
      </div>
    </div>
  );
}
