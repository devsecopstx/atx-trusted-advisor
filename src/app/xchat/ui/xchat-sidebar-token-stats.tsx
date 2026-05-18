"use client";

import { useQuery } from "@tanstack/react-query";

import { xchatTokenStatsQueryKeys } from "@/lib/react-query/query-keys";
import { fetchXchatTokenStats } from "@/lib/react-query/xchat-token-stats-api";

const POLL_MS = 60_000;

function formatTokens(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export type XchatSidebarTokenStatsProps = {
  layout?: "stack" | "inline";
};

export function XchatSidebarTokenStats({ layout = "stack" }: XchatSidebarTokenStatsProps) {
  const { data, error, isPending, isError } = useQuery({
    queryKey: xchatTokenStatsQueryKeys.all,
    queryFn: fetchXchatTokenStats,
    staleTime: 55_000,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false
  });

  const rootCls =
    layout === "inline" ? "xchat-rail-token-stats xchat-rail-token-stats--inline" : "xchat-rail-token-stats";

  if (isPending && !data) {
    return (
      <div aria-busy className={rootCls} role="status">
        <p className="status-text xchat-rail-token-stats__line">Token usage…</p>
      </div>
    );
  }

  if (isError || !data) {
    const message = error instanceof Error ? error.message : "Could not load token usage";
    return (
      <div className={rootCls} role="status">
        <p className="status-text status-error xchat-rail-token-stats__line">{message}</p>
      </div>
    );
  }

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
