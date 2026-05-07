"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type {
    AdminOpsJobRunRow,
    AdminOpsPlatformMetrics,
    AdminOpsSummaryResponse
} from "@/lib/admin-ops-summary-contract";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function formatRelativeShort(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (Number.isNaN(diffSec)) {
    return "—";
  }
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) {
    return rtf.format(diffSec, "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) {
    return rtf.format(diffHr, "hour");
  }
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(diffDay, "day");
}

type SortKey = "startedAt" | "durationMs" | "jobType" | "status" | "tenant";

function statusBadgeClass(s: AdminOpsJobRunRow["status"]): string {
  if (s === "success") {
    return "rounded-full bg-[color-mix(in_srgb,var(--xf-gain-green)_22%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--xf-gain-green)]";
  }
  if (s === "failed") {
    return "rounded-full bg-[color-mix(in_srgb,var(--xf-chart-loss,_#ef4444)_22%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--xf-chart-loss,_#ef4444)]";
  }
  return "rounded-full bg-[color-mix(in_srgb,var(--xf-lightning-yellow,_#eab308)_22%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--xf-lightning-yellow,_#eab308)]";
}

function metricCard(props: {
  title: string;
  subtitle?: string;
  value: ReactNode;
  footer?: ReactNode;
  href?: string;
  icon?: ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--xf-text-muted)]">
            {props.title}
          </p>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--xf-text-100)]">{props.value}</div>
          {props.subtitle ? (
            <p className="mt-1 text-xs text-[var(--xf-text-400)]">{props.subtitle}</p>
          ) : null}
        </div>
        {props.icon ? (
          <div className="text-[var(--xf-text-muted)] opacity-80" aria-hidden>
            {props.icon}
          </div>
        ) : null}
      </div>
      {props.footer ? <div className="mt-3 text-xs text-[var(--xf-text-400)]">{props.footer}</div> : null}
    </>
  );
  const className =
    "admin-function-card block h-full transition-colors hover:border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)]";
  if (props.href) {
    return (
      <Link href={props.href} className={className}>
        <span className="admin-function-copy flex flex-col items-stretch gap-0">{inner}</span>
      </Link>
    );
  }
  return (
    <article className={className}>
      <span className="admin-function-copy flex flex-col items-stretch gap-0">{inner}</span>
    </article>
  );
}

function OpsSkeleton() {
  return (
    <section className="panel stack-gap">
      <div className="panel-header">
        <h2>Platform Ops Summary</h2>
        <p>Loading KPIs and cross-job activity…</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="admin-function-card animate-pulse"
            aria-busy
            aria-label="Loading metric"
          >
            <span className="admin-function-copy">
              <div className="h-3 w-24 rounded bg-[var(--xf-surface-700)]" />
              <div className="mt-3 h-8 w-16 rounded bg-[var(--xf-surface-700)]" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlatformOpsBatchDashboard() {
  const [data, setData] = useState<AdminOpsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  useEffect(() => {
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const ops: AdminOpsPlatformMetrics | undefined = data?.platformOps;

  const sortedJobs = useMemo(() => {
    const rows = ops?.lastFiveJobs ? [...ops.lastFiveJobs] : [];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "startedAt") {
        cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      } else if (sortKey === "durationMs") {
        const da = a.durationMs ?? -1;
        const db = b.durationMs ?? -1;
        cmp = da - db;
      } else if (sortKey === "jobType") {
        cmp = a.jobType.localeCompare(b.jobType);
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      } else {
        cmp = (a.tenantSlug ?? a.tenantName ?? "").localeCompare(b.tenantSlug ?? b.tenantName ?? "");
      }
      return cmp * dir;
    });
    return rows;
  }, [ops?.lastFiveJobs, sortDir, sortKey]);

  const toggleSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "startedAt" ? "desc" : "asc");
      return key;
    });
  };

  const platformWide = ops?.scope === "platform";

  const costTodayLine = ops
    ? `${formatUsd(ops.costEstimate.todayTotalUsd)} today`
    : "";
  const costMtdLine = ops ? `${formatUsd(ops.costEstimate.monthToDateTotalUsd)} MTD` : "";

  if (loading && !data) {
    return <OpsSkeleton />;
  }

  if (error || !ops) {
    return (
      <section className="panel stack-gap">
        <div className="panel-header">
          <h2>Platform Ops Summary</h2>
          <p>Could not load ops snapshot.</p>
        </div>
        <p className="status-text">{error ?? "Unknown error"}</p>
        <button type="button" className="cta cta-secondary text-sm" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  }

  const tenantsHref = platformWide ? "/admin/tenant-register" : undefined;
  const usersHref = platformWide ? "/admin/manage-users" : undefined;
  const loginHref = platformWide ? "/admin/login-audit" : undefined;

  return (
    <>
      <section className="panel stack-gap">
        <div className="panel-header flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2>Platform Ops Summary</h2>
            <p>
              KPI snapshot ({ops.scope === "platform" ? "all tenants" : "current tenant"}) · refreshes every
              30s.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="cta cta-secondary text-sm" onClick={() => void load()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
            <button
              type="button"
              className="cta cta-secondary cursor-not-allowed text-sm opacity-60"
              disabled
              title="Coming soon"
            >
              Download Ops Report CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metricCard({
            title: "Tenants",
            value: ops.tenantsActive,
            subtitle: platformWide ? "Active tenant rows (`core_tenants`)" : ops.currentTenantName ?? "Your tenant",
            href: tenantsHref,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 21V10M4 10l4-6 4 6 4-6 4 6v11"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          })}
          {metricCard({
            title: "Users",
            value: ops.usersRegistered,
            subtitle: platformWide ? "Registered (`core_users`)" : "Memberships for this tenant",
            href: usersHref,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            )
          })}
          {metricCard({
            title: "Logins (24h)",
            value:
              ops.logins24h !== null ? (
                <>
                  {ops.logins24h}
                  {ops.logins7d !== null ? (
                    <span className="text-base font-semibold text-[var(--xf-text-300)]">
                      {" "}
                      · Last 7d: {ops.logins7d}
                    </span>
                  ) : null}
                </>
              ) : (
                "—"
              ),
            subtitle:
              ops.loginsUnavailableReason ??
              "Successful sign-ins (`audit_login`) — platform-wide totals.",
            href: loginHref,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          })}
          {metricCard({
            title: "xChat activity",
            value: (
              <>
                {ops.xchat.promptsToday}
                <span className="text-base font-semibold text-[var(--xf-text-300)]"> prompts</span>
              </>
            ),
            subtitle: `Peak today · ${String(ops.xchat.hourlyPeakToday)}/hr (UTC buckets)`,
            footer:
              ops.xchat.xchatLogsPromptCountToday !== undefined ? (
                <span>
                  xchat_logs today (opt-in):{" "}
                  <strong className="text-[var(--xf-text-200)]">{ops.xchat.xchatLogsPromptCountToday}</strong>
                </span>
              ) : undefined,
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          })}
          {metricCard({
            title: "Recent workload",
            value: ops.lastFiveJobs.length,
            subtitle: "Latest unified jobs (see table below)",
            href: "#platform-ops-last-jobs",
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          })}
          {metricCard({
            title: "Cost estimates",
            value: (
              <>
                {costTodayLine}
                <div className="mt-1 text-sm font-semibold text-[var(--xf-text-300)]">{costMtdLine}</div>
              </>
            ),
            subtitle: "Conservative · tune via OPS_SUMMARY_* env vars",
            footer: (
              <span className="text-[var(--xf-text-muted)]">
                Full breakdown UI — roadmap (rates shown in API notes).
              </span>
            ),
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            )
          })}
        </div>
      </section>

      <section className="panel stack-gap" id="platform-ops-last-jobs">
        <div className="panel-header">
          <h2>Summary of Tasks · Last 5 Jobs Run</h2>
          <p>
            Merged from xChat batch, scheduled task runs, and strategy jobs — newest first by default. Click a row
            to drill down.
          </p>
        </div>
        {sortedJobs.length === 0 ? (
          <p className="status-text">No recent jobs in scope.</p>
        ) : (
          <div className="crud-table-wrap overflow-x-auto">
            <table className="crud-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => toggleSort("jobType")}>
                      Type {sortKey === "jobType" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>Trigger</th>
                  <th>
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => toggleSort("status")}>
                      Status {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => toggleSort("startedAt")}>
                      Started {sortKey === "startedAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => toggleSort("durationMs")}>
                      Duration {sortKey === "durationMs" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => toggleSort("tenant")}>
                      Tenant {sortKey === "tenant" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>Items / Errors</th>
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((row) => (
                  <tr key={`${row.jobType}-${row.jobId}`}>
                    <td>
                      <Link className="text-[var(--xf-gain-green)] underline" href={row.detailHref}>
                        <code>{row.jobId}</code>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs">{row.jobType}</td>
                    <td className="max-w-[11rem] truncate text-xs">{row.trigger}</td>
                    <td>
                      <span className={statusBadgeClass(row.status)}>{row.status}</span>
                    </td>
                    <td className="text-xs text-[var(--xf-text-300)]">
                      <span title={new Date(row.startedAt).toISOString()}>{formatRelativeShort(row.startedAt)}</span>
                    </td>
                    <td className="font-mono text-xs">{row.durationLabel ?? "—"}</td>
                    <td className="text-xs">{row.tenantSlug ?? row.tenantName ?? "—"}</td>
                    <td className="font-mono text-xs">
                      {row.itemsProcessed ?? "—"} / {row.errors ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
