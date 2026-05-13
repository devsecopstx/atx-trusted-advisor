"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

import {
    shouldShowXchatPromptSoftLimitBanner,
    xchatPromptUsageMeterFillVar
} from "@/modules/xchat/plan-limits";

export type XchatPromptUsagePayload = {
  usedToday: number;
  usedThisHour: number;
  dailyCap: number;
  hourlyCap: number;
  softLimitPercent: number;
  utcDayResetInHours: number;
  utcHourResetInMinutes: number;
  workspaceCapsEnforced: boolean;
  limitsFallback?: "plan_defaults";
};

const POLL_MS = 35_000;
/** Aligns with route `Cache-Control` (~25s); avoids duplicate work from rail + composer meters. */
const PROMPT_USAGE_CLIENT_TTL_MS = 20_000;

let promptUsageClientCache: { expiresAt: number; data: XchatPromptUsagePayload } | null = null;
let promptUsageClientInflight: Promise<XchatPromptUsagePayload> | null = null;

function invalidateXchatPromptUsageClientCache(): void {
  promptUsageClientCache = null;
}

/** Shared across rail + composer so only one invalidates per `refreshSignal` bump. */
let lastAppliedXchatPromptUsageRefresh: number = Number.NaN;

async function fetchXchatPromptUsageShared(): Promise<XchatPromptUsagePayload> {
  const now = Date.now();
  if (promptUsageClientCache && promptUsageClientCache.expiresAt > now) {
    return promptUsageClientCache.data;
  }
  if (promptUsageClientInflight) {
    return promptUsageClientInflight;
  }
  promptUsageClientInflight = (async () => {
    try {
      const res = await fetch("/api/app-user/xchat/prompt-usage", {
        credentials: "include"
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: XchatPromptUsagePayload;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (!body.data) {
        throw new Error("Missing prompt usage payload");
      }
      promptUsageClientCache = {
        expiresAt: Date.now() + PROMPT_USAGE_CLIENT_TTL_MS,
        data: body.data
      };
      return body.data;
    } finally {
      promptUsageClientInflight = null;
    }
  })();
  return promptUsageClientInflight;
}

type FetchState =
  | { status: "loading" }
  | { status: "ok"; data: XchatPromptUsagePayload }
  | { status: "error"; message: string };

export type XchatUsageMeterProps = {
  variant: "composer" | "rail";
  refreshSignal?: number;
};

export function XchatUsageMeter({ variant, refreshSignal = 0 }: XchatUsageMeterProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const data = await fetchXchatPromptUsageShared();
      startTransition(() => {
        setState({ status: "ok", data });
      });
    } catch (e) {
      startTransition(() => {
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Could not load prompt usage"
        });
      });
    }
  }, []);

  useEffect(() => {
    if (!Number.isFinite(lastAppliedXchatPromptUsageRefresh) || lastAppliedXchatPromptUsageRefresh !== refreshSignal) {
      invalidateXchatPromptUsageClientCache();
      lastAppliedXchatPromptUsageRefresh = refreshSignal;
    }
    const initial = window.setTimeout(() => {
      void load();
    }, 0);
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [load, refreshSignal]);

  const rootCls = variant === "rail" ? "xchat-usage-meter xchat-usage-meter--rail" : "xchat-usage-meter";

  if (state.status === "loading") {
    return (
      <div aria-busy className={rootCls} role="status">
        <p className="status-text xchat-usage-meter__line">Prompt usage…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={rootCls} role="status">
        <p className="status-text status-error xchat-usage-meter__line">{state.message}</p>
      </div>
    );
  }

  const d = state.data;
  const cap = Math.max(1, d.dailyCap);
  const used = Math.max(0, d.usedToday);
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const fillVar = xchatPromptUsageMeterFillVar({ usedToday: used, dailyCap: cap });
  const showSoftBanner =
    d.workspaceCapsEnforced &&
    shouldShowXchatPromptSoftLimitBanner({
      usedToday: used,
      dailyCap: cap,
      planSoftLimitPercent: d.softLimitPercent
    });

  const hoursLabel =
    d.utcDayResetInHours >= 1
      ? `${d.utcDayResetInHours.toFixed(1)} hours`
      : `${Math.max(1, Math.round(d.utcDayResetInHours * 60))} min`;

  return (
    <div className={rootCls} role="region" aria-label="xChat prompt usage">
      {d.limitsFallback === "plan_defaults" ? (
        <p className="status-text xchat-usage-meter__fallback">
          Showing plan defaults — workspace limits unavailable momentarily.
        </p>
      ) : null}
      {!d.workspaceCapsEnforced ? (
        <p className="status-text xchat-usage-meter__admin-note">
          Admin session — workspace daily caps are not enforced on your sends.
        </p>
      ) : null}
      {showSoftBanner ? (
        <div className="xchat-usage-meter__banner" role="status">
          Approaching today&apos;s xChat prompt cap ({pct}% of UTC daily allowance).{" "}
          <Link className="xchat-usage-meter__banner-link" href="/account/billing">
            Compare plans
          </Link>
        </div>
      ) : null}
      <p className="status-text xchat-usage-meter__line">
        <span className="xchat-usage-meter__value">
          {used} / {cap}
        </span>{" "}
        prompts today · UTC reset in ~{hoursLabel}
      </p>
      <div aria-valuemax={100} aria-valuemin={0} aria-valuenow={pct} className="xchat-usage-meter__track" role="progressbar">
        <div className="xchat-usage-meter__fill" style={{ width: `${pct}%`, backgroundColor: fillVar }} />
      </div>
      {d.hourlyCap > 0 && d.workspaceCapsEnforced ? (
        <p className="status-text xchat-usage-meter__line xchat-usage-meter__line--muted">
          This UTC hour: {Math.max(0, d.usedThisHour)} / {d.hourlyCap} · hour resets in ~
          {Math.max(1, Math.round(d.utcHourResetInMinutes))} min
        </p>
      ) : null}
    </div>
  );
}
