"use client";

import { useCallback, useEffect, useState } from "react";

import type { AdminOpsSummaryResponse } from "@/lib/admin-ops-summary-contract";

function badgeClassForHealth(ok: boolean, skipped?: boolean): string {
  if (skipped) {
    return "status-badge status-pending";
  }
  return ok ? "status-badge status-live" : "status-badge status-error";
}

function redisLabel(redis: AdminOpsSummaryResponse["nextApp"]["redis"]): { text: string; ok: boolean; skipped: boolean } {
  if (redis.status === "skipped") {
    return { text: redis.reason, ok: true, skipped: true };
  }
  if (redis.status === "ok") {
    return { text: `OK (${String(redis.latencyMs)} ms)`, ok: true, skipped: false };
  }
  return { text: redis.message, ok: false, skipped: false };
}

export function AdminOpsSummaryPanel() {
  const [data, setData] = useState<AdminOpsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system/ops-summary", { cache: "no-store" });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `HTTP ${String(res.status)}`);
        setData(null);
        return;
      }
      setData((await res.json()) as AdminOpsSummaryResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nextRedis = data ? redisLabel(data.nextApp.redis) : null;
  const backend = data?.backend;

  const backendSummary = (() => {
    if (!backend) {
      return "—";
    }
    if (!backend.configured) {
      return backend.skippedReason ?? "Not configured";
    }
    if (!backend.httpReachable) {
      return backend.fetchError ?? "Unreachable";
    }
    if (backend.fetchError) {
      return backend.fetchError;
    }
    const parts: string[] = [];
    if (backend.service) {
      parts.push(backend.service);
    }
    if (backend.mongoStatus) {
      parts.push(`Mongo: ${backend.mongoStatus}`);
    }
    if (backend.redisStatus) {
      parts.push(`Redis: ${backend.redisStatus}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "Reachable";
  })();

  return (
    <section className="panel stack-gap">
      <div className="panel-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Ops summary</h2>
            <p className="text-sm text-[var(--xf-text-300)]">
              Database, Redis, and GCP-style split: this Next service (frontend) vs optional Spring worker (
              <code className="text-xs">ATXFINANCE_BACKEND_ORIGIN</code>). Redacted URI details:{" "}
              <a className="text-[var(--xf-gain-green)] underline" href="/admin/manage-backoffice">
                Manage backoffice
              </a>
              .
            </p>
          </div>
          <button type="button" className="cta cta-secondary text-sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <p className="status-text status-error text-sm">{error}</p> : null}

      {loading && !data ? <p className="text-sm text-[var(--xf-text-300)]">Loading status…</p> : null}

      {data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-800)]/40 p-4">
            <h3 className="text-sm font-semibold text-[var(--xf-text-100)]">Frontend (Next)</h3>
            <p className="mt-1 font-mono text-xs text-[var(--xf-text-300)]">
              {data.nextApp.service} v{data.nextApp.version}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--xf-text-300)]">MongoDB</span>
                <span
                  className={badgeClassForHealth(
                    data.nextApp.database.ok,
                    false
                  )}
                >
                  {data.nextApp.database.ok
                    ? `OK · ${data.nextApp.database.name ?? "?"}`
                    : data.nextApp.database.error ?? "Error"}
                </span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--xf-text-300)]">Redis (Next)</span>
                {nextRedis ? (
                  <span className={badgeClassForHealth(nextRedis.ok, nextRedis.skipped)}>{nextRedis.text}</span>
                ) : null}
              </li>
            </ul>
            <p className="mt-3 text-xs text-[var(--xf-text-400)]">Checked {data.generatedAt}</p>
          </div>

          <div className="rounded-lg border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-800)]/40 p-4">
            <h3 className="text-sm font-semibold text-[var(--xf-text-100)]">Compute backend (Spring)</h3>
            {backend?.origin ? (
              <p className="mt-1 break-all font-mono text-xs text-[var(--xf-text-300)]">{backend.origin}</p>
            ) : (
              <p className="mt-1 text-xs text-[var(--xf-text-400)]">No backend origin configured</p>
            )}
            <p className="mt-3 text-sm text-[var(--xf-text-200)]">{backendSummary}</p>
            {backend?.configured && backend.httpReachable && !backend.fetchError ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={badgeClassForHealth(
                    backend.mongoStatus === "ok",
                    false
                  )}
                >
                  Mongo: {backend.mongoStatus ?? "?"}
                </span>
                <span
                  className={badgeClassForHealth(
                    backend.redisStatus === "ok" || backend.redisStatus === "skipped",
                    backend.redisStatus === "skipped"
                  )}
                >
                  Redis: {backend.redisStatus ?? "?"}
                  {backend.redisDetail ? ` — ${backend.redisDetail}` : ""}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
