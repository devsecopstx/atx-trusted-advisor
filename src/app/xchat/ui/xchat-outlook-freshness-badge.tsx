"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OutlookContextPayload = {
  portfolioId: string | null;
  marketOutlookLabel: string | null;
  lastOutlookRefreshAt: string | null;
  fetchMs?: number;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: OutlookContextPayload }
  | { status: "error" };

function formatOutlookAgeLabel(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  const minutes = Math.max(0, Math.floor((Date.now() - at.getTime()) / 60_000));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours} hr ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export type XchatOutlookFreshnessBadgeProps = {
  workspacePortfolioId: string | null | undefined;
};

export function XchatOutlookFreshnessBadge({ workspacePortfolioId }: XchatOutlookFreshnessBadgeProps) {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const portfolioId = workspacePortfolioId?.trim() || "";

  const load = useCallback(async () => {
    if (!portfolioId) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    const startedAt = performance.now();
    try {
      performance.mark("xchat-outlook-context-fetch-start");
      const url = new URL("/api/app-user/xchat/outlook-context", window.location.origin);
      url.searchParams.set("portfolioId", portfolioId);
      const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { data?: OutlookContextPayload };
      if (!res.ok || !body.data) {
        setState({ status: "error" });
        return;
      }
      const fetchMs = Math.max(0, Math.round(performance.now() - startedAt));
      try {
        performance.mark("xchat-outlook-context-fetch-end");
        performance.measure(
          "outlook-context-fetch-ms",
          "xchat-outlook-context-fetch-start",
          "xchat-outlook-context-fetch-end"
        );
      } catch {
        /* ignore */
      }
      setState({
        status: "ok",
        data: {
          ...body.data,
          fetchMs: body.data.fetchMs ?? fetchMs
        }
      });
    } catch {
      setState({ status: "error" });
    }
  }, [portfolioId]);

  useEffect(() => {
    void load();
  }, [load]);

  const label = useMemo(() => {
    if (state.status !== "ok") {
      return null;
    }
    const age = formatOutlookAgeLabel(state.data.lastOutlookRefreshAt);
    const outlook = state.data.marketOutlookLabel?.trim();
    if (!age && !outlook) {
      return null;
    }
    if (age && outlook) {
      return `Outlook ${outlook} · refreshed ${age}`;
    }
    if (age) {
      return `Outlook refreshed ${age}`;
    }
    return outlook ? `Outlook ${outlook}` : null;
  }, [state]);

  if (!label) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className="xchat-outlook-freshness-badge"
      style={{
        margin: "0 0 0.35rem",
        fontSize: "0.72rem",
        lineHeight: 1.35,
        color: "var(--xf-text-muted)",
        textAlign: "center"
      }}
    >
      {label}
    </p>
  );
}
