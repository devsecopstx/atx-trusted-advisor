"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;
const MIN_FETCH_GAP_MS = 55_000;

type TokenStatsPayload = {
  totalTokens: number;
  turnsWithUsage: number;
  tokensPerMinuteAvg60m: number;
  windowMinutes: number;
};

type FetchState =
  | { status: "loading" }
  | { status: "ok"; data: TokenStatsPayload }
  | { status: "error"; message: string };

function formatTokens(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export type XchatSidebarTokenStatsProps = {
  layout?: "stack" | "inline";
};

export function XchatSidebarTokenStats({ layout = "stack" }: XchatSidebarTokenStatsProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const lastFetchAtRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchStats = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchAtRef.current < MIN_FETCH_GAP_MS && lastFetchAtRef.current > 0) {
      return;
    }
    lastFetchAtRef.current = now;

    setState((prev) => (prev.status === "ok" ? prev : { status: "loading" as const }));

    try {
      const res = await fetch("/api/app-user/xchat/token-stats", {
        credentials: "include",
        cache: "no-store"
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: TokenStatsPayload;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (!body.data) {
        throw new Error("Missing stats payload");
      }
      if (!mountedRef.current) {
        return;
      }
      setState({ status: "ok", data: body.data });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load token usage";
      if (mountedRef.current) {
        setState({ status: "error", message });
      }
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const id = window.setInterval(() => void fetchStats(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchStats]);

  const rootCls =
    layout === "inline" ? "xchat-rail-token-stats xchat-rail-token-stats--inline" : "xchat-rail-token-stats";

  if (state.status === "loading") {
    return (
      <div aria-busy className={rootCls} role="status">
        <p className="status-text xchat-rail-token-stats__line">Token usage…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={rootCls} role="status">
        <p className="status-text status-error xchat-rail-token-stats__line">{state.message}</p>
      </div>
    );
  }

  const { data } = state;
  const hasUsage = data.turnsWithUsage > 0;
  const rateLabel =
    data.tokensPerMinuteAvg60m <= 0
      ? "0"
      : data.tokensPerMinuteAvg60m >= 100
        ? formatTokens(Math.round(data.tokensPerMinuteAvg60m))
        : data.tokensPerMinuteAvg60m.toFixed(1);

  if (layout === "inline") {
    return (
      <div className={rootCls} role="region" aria-label="xChat token usage">
        <p className="status-text xchat-rail-token-stats__line">
          <span className="xchat-rail-token-stats__value">{formatTokens(data.totalTokens)}</span> tokens · ~
          {rateLabel}/min
          {!hasUsage ? " · pending usage" : null}
        </p>
      </div>
    );
  }

  return (
    <div className={rootCls} role="region" aria-label="xChat token usage">
      <p className="status-text xchat-rail-token-stats__line">
        <span className="xchat-rail-token-stats__value">{formatTokens(data.totalTokens)}</span> tokens
        {hasUsage ? "" : " · no provider totals yet"}
      </p>
      <p className="status-text xchat-rail-token-stats__line xchat-rail-token-stats__line--muted">
        ~{rateLabel}/min · last {data.windowMinutes}m avg
      </p>
      {!hasUsage ? (
        <p className="status-text xchat-rail-token-stats__hint">
          Totals fill in when xAI returns usage on a turn.
        </p>
      ) : null}
    </div>
  );
}
