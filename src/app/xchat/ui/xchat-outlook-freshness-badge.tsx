"use client";

import { useEffect, useMemo, useState } from "react";

import {
    formatOutlookFreshnessLabel,
    type XchatInitialOutlookDesk
} from "@/lib/xchat/xchat-outlook-desk";

type OutlookContextPayload = {
  portfolioId: string | null;
  marketOutlookLabel: string | null;
  lastOutlookRefreshAt: string | null;
  fetchMs?: number;
};

type FetchedOutlook = {
  portfolioId: string;
  data: OutlookContextPayload;
};

export type XchatOutlookFreshnessBadgeProps = {
  workspacePortfolioId: string | null | undefined;
  /** When set (SSR / parent), skip the first client fetch for this portfolio. */
  initialOutlookDesk?: XchatInitialOutlookDesk | null;
};

export function XchatOutlookFreshnessBadge({
  workspacePortfolioId,
  initialOutlookDesk = null
}: XchatOutlookFreshnessBadgeProps) {
  const portfolioId = workspacePortfolioId?.trim() || "";
  const initialMatchesPortfolio =
    Boolean(initialOutlookDesk) &&
    Boolean(portfolioId) &&
    initialOutlookDesk?.portfolioId === portfolioId;

  const seededDesk = useMemo<OutlookContextPayload | null>(() => {
    if (!initialMatchesPortfolio || !initialOutlookDesk) {
      return null;
    }
    return {
      portfolioId: initialOutlookDesk.portfolioId,
      marketOutlookLabel: initialOutlookDesk.marketOutlookLabel,
      lastOutlookRefreshAt: initialOutlookDesk.lastOutlookRefreshAt
    };
  }, [initialMatchesPortfolio, initialOutlookDesk]);

  const [fetchedDesk, setFetchedDesk] = useState<FetchedOutlook | null>(null);

  useEffect(() => {
    if (!portfolioId || initialMatchesPortfolio) {
      return;
    }

    let cancelled = false;
    const startedAt = performance.now();

    void (async () => {
      try {
        performance.mark("xchat-outlook-context-fetch-start");
        const url = new URL("/api/app-user/xchat/outlook-context", window.location.origin);
        url.searchParams.set("portfolioId", portfolioId);
        const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { data?: OutlookContextPayload };
        if (cancelled || !res.ok || !body.data) {
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
        setFetchedDesk({
          portfolioId,
          data: {
            ...body.data,
            fetchMs: body.data.fetchMs ?? fetchMs
          }
        });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialMatchesPortfolio, portfolioId]);

  const activeDesk =
    seededDesk ??
    (fetchedDesk?.portfolioId === portfolioId ? fetchedDesk.data : null);

  const label = useMemo(() => {
    if (!activeDesk) {
      return null;
    }
    return formatOutlookFreshnessLabel({
      marketOutlookLabel: activeDesk.marketOutlookLabel,
      lastOutlookRefreshAt: activeDesk.lastOutlookRefreshAt
    });
  }, [activeDesk]);

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
