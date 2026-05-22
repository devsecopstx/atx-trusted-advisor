"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import { auditLoginUtcDayBounds } from "@/lib/audit-login-utc-day";

type LoginAuditRow = {
  _id?: string;
  outcome: "success" | "failure";
  provider: string;
  errorCode?: string;
  clientIp?: string;
  country?: string;
  userAgent?: string;
  userId?: string;
  xUserId?: string;
  username?: string;
  email?: string;
  createdAt: string;
};

const FETCH_LIMIT = 500;

export function LoginsTodayConsole() {
  const [rows, setRows] = useState<LoginAuditRow[]>([]);
  const [status, setStatus] = useState("Loading…");

  function fullLoginAuditTodayHref(): string {
    const { from, to } = auditLoginUtcDayBounds();
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      limit: String(FETCH_LIMIT)
    });
    return `/admin/login-audit?${params.toString()}`;
  }

  const load = useCallback(async () => {
    await Promise.resolve();
    setStatus("Loading…");
    const { from, to, label } = auditLoginUtcDayBounds();
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      limit: String(FETCH_LIMIT)
    });
    try {
      const payload = await parseJson<{ data: LoginAuditRow[] }>(
        await fetch(`/api/admin/login-audit?${params.toString()}`)
      );
      setRows(payload.data);
      const n = payload.data.length;
      const successes = payload.data.filter((r) => r.outcome === "success").length;
      const failures = payload.data.filter((r) => r.outcome === "failure").length;
      const capped = n >= FETCH_LIMIT;
      setStatus(
        `${label}: ${n} attempt${n === 1 ? "" : "s"} (${successes} success, ${failures} failed)${
          capped ? ` — newest ${FETCH_LIMIT} only` : ""
        }`
      );
    } catch (error) {
      setRows([]);
      setStatus(error instanceof Error ? error.message : "Failed to load today's logins");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const dayLabel = useMemo(() => auditLoginUtcDayBounds().label, []);

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <div className="tool-row flex-wrap">
          <div>
            <h3 className="m-0">Logins today</h3>
            <p className="mt-1 text-sm text-[var(--xf-text-muted)]">
              Successful and failed sign-in attempts since UTC midnight ({dayLabel}), newest first — same window as the
              hub quick stat.
              Raw feed:{" "}
              <Link className="text-[var(--xf-gain-green)] underline" href="/admin/login-audit">
                Login audit
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="cta cta-secondary" onClick={() => void load()} type="button">
              Refresh
            </button>
            <Link className="cta cta-primary" href={fullLoginAuditTodayHref()}>
              Open in Login audit
            </Link>
          </div>
        </div>
        <p className="status-text">{status}</p>
        <div className="crud-table-wrap mt-4">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Outcome</th>
                <th>User</th>
                <th>Provider</th>
                <th>Error</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-[var(--xf-text-muted)]">
                    No login attempts recorded today yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id ?? `${row.createdAt}-${row.clientIp ?? ""}-${row.email ?? ""}-${row.outcome}`}>
                    <td className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                    <td
                      className={
                        row.outcome === "success" ? "text-[var(--xf-gain-green)]" : "text-red-400"
                      }
                    >
                      {row.outcome}
                    </td>
                    <td
                      className="max-w-[240px] truncate font-mono text-xs"
                      title={[row.email, row.username, row.userId].filter(Boolean).join(" · ") || undefined}
                    >
                      {row.email ?? row.username ?? row.userId ?? "—"}
                    </td>
                    <td>{row.provider}</td>
                    <td className="max-w-[180px] truncate font-mono text-xs" title={row.errorCode}>
                      {row.errorCode ?? "—"}
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs">{row.clientIp ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div className="tool-row flex-wrap">
        <Link className="cta cta-secondary" href="/admin/audit">
          Audit explorer
        </Link>
        <Link className="cta cta-secondary" href="/admin">
          Admin hub
        </Link>
      </div>
    </section>
  );
}
