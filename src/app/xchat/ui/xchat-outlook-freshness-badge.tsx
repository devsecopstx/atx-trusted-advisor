"use client";

import { useEffect, useMemo, useState } from "react";

import { useXchatOutlookBookScope } from "@/app/xchat/ui/use-xchat-outlook-book-scope";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
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
  workspaceBook?: AppUserDefaultBook | null;
  /** When set (SSR / parent), skip the first client fetch for this portfolio. */
  initialOutlookDesk?: XchatInitialOutlookDesk | null;
  /** Welcome header row layout (right-aligned, next to usage %). */
  inline?: boolean;
};

export function XchatOutlookFreshnessBadge({
  workspacePortfolioId,
  workspaceBook = null,
  initialOutlookDesk = null,
  inline = false
}: XchatOutlookFreshnessBadgeProps) {
  const bookScope = useXchatOutlookBookScope(workspaceBook, workspacePortfolioId);
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
      lastOutlookRefreshAt: activeDesk.lastOutlookRefreshAt,
      bookScope
    });
  }, [activeDesk, bookScope]);

  if (!label) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={
        inline
          ? "xchat-outlook-freshness-badge xchat-outlook-freshness-badge--welcome-row"
          : "xchat-outlook-freshness-badge"
      }
      title={label}
    >
      {label}
    </p>
  );
}
