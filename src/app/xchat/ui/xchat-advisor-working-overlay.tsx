"use client";

import { useEffect, useMemo, useState } from "react";

import { XCHAT_ASK_PROGRESS_BADGES } from "@/app/xchat/ui/xchat-ask-progress-badges";

type TokenStatsPayload = {
  totalTokens: number;
  turnsWithUsage: number;
  tokensPerMinuteAvg60m: number;
  windowMinutes: number;
};

function formatTokens(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatElapsedLabel(ms: number): string {
  const s = ms / 1000;
  if (s < 60) {
    return `${s.toFixed(1)}s elapsed`;
  }
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  return `${m}m ${rs}s elapsed`;
}

export type XchatAdvisorWorkingOverlayProps = {
  loading: boolean;
  askElapsedMs: number;
  askProgressPhaseIndex: number;
  onStop: () => void;
};

export function XchatAdvisorWorkingOverlay({
  loading,
  askElapsedMs,
  askProgressPhaseIndex,
  onStop
}: XchatAdvisorWorkingOverlayProps) {
  const [stats, setStats] = useState<TokenStatsPayload | null>(null);

  useEffect(() => {
    if (!loading) {
      return;
    }
    let cancelled = false;
    void fetch("/api/app-user/xchat/token-stats", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { data?: TokenStatsPayload };
        if (!cancelled && res.ok && body.data) {
          setStats(body.data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading]);

  const progressPct = useMemo(() => {
    if (!loading || askProgressPhaseIndex < 0) {
      return 12;
    }
    const bases: readonly number[] = [28, 48, 68, 85];
    const base = bases[Math.min(askProgressPhaseIndex, bases.length - 1)] ?? 28;
    const micro = Math.min(7, ((askElapsedMs % 900) / 900) * 7);
    return Math.min(92, base + micro);
  }, [loading, askProgressPhaseIndex, askElapsedMs]);

  const phaseLabel = useMemo(() => {
    if (!loading || askProgressPhaseIndex < 0) {
      return "";
    }
    return XCHAT_ASK_PROGRESS_BADGES[Math.min(askProgressPhaseIndex, XCHAT_ASK_PROGRESS_BADGES.length - 1)]!;
  }, [loading, askProgressPhaseIndex]);

  if (!loading) {
    return null;
  }

  const tokensLabel =
    stats != null ? `${formatTokens(stats.totalTokens)} tokens` : "— tokens";
  const speedLabel =
    stats != null && stats.turnsWithUsage > 0
      ? stats.tokensPerMinuteAvg60m >= 100
        ? `~${formatTokens(Math.round(stats.tokensPerMinuteAvg60m))}/min avg`
        : `~${stats.tokensPerMinuteAvg60m.toFixed(1)}/min avg`
      : "~—/min avg";
  const contextLabel = stats != null ? `${stats.windowMinutes}m context` : "— context";

  return (
    <div aria-live="polite" className="fixed bottom-[108px] left-1/2 z-[80] -translate-x-1/2" role="status">
      <div className="w-[380px] max-w-[min(380px,calc(100vw-1.5rem))] rounded-2xl border border-slate-600 bg-[#1E293B] px-5 py-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
            <span className="truncate text-sm font-medium text-slate-200">Advisor is working...</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-slate-400">{formatElapsedLabel(askElapsedMs)}</span>
            <button
              aria-label="Stop generating"
              className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/25"
              type="button"
              onClick={() => onStop()}
            >
              Stop
            </button>
          </div>
        </div>

        {phaseLabel ? (
          <p className="mb-2 line-clamp-2 text-[11px] leading-snug text-slate-500">{phaseLabel}</p>
        ) : null}

        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full bg-emerald-400 transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex justify-between gap-2 text-[11px] text-slate-400">
          <div className="min-w-0 truncate">{tokensLabel}</div>
          <div className="shrink-0">{speedLabel}</div>
          <div className="shrink-0">{contextLabel}</div>
        </div>
      </div>
    </div>
  );
}
