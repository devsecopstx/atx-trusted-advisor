"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

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

function localDayBounds(): { from: Date; to: Date; label: string } {
  const n = new Date();
  const from = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
  const to = new Date();
  const label = from.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  return { from, to, label };
}

export function TodayLoginsPanel() {
  const [rows, setRows] = useState<LoginAuditRow[]>([]);
  const [status, setStatus] = useState("Loading…");

  function loginAuditTodayHref(): string {
    const { from, to } = localDayBounds();
    const params = new URLSearchParams({
      outcome: "success",
      from: from.toISOString(),
      to: to.toISOString(),
      limit: "500"
    });
    return `/admin/login-audit?${params.toString()}`;
  }

  const load = useCallback(async () => {
    await Promise.resolve();
    setStatus("Loading…");
    const { from, to, label } = localDayBounds();
    const params = new URLSearchParams({
      outcome: "success",
      from: from.toISOString(),
      to: to.toISOString(),
      limit: "200"
    });
    try {
      const payload = await parseJson<{ data: LoginAuditRow[] }>(
        await fetch(`/api/admin/login-audit?${params.toString()}`)
      );
      setRows(payload.data);
      const n = payload.data.length;
      const capped = n >= 200;
      setStatus(
        `${label}: ${n} successful login${n === 1 ? "" : "s"}${capped ? " (showing newest 200)" : ""}`
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

  const dayLabel = useMemo(() => localDayBounds().label, []);

  return (
    <article className="surface-card xf-widget section-card">
      <div className="tool-row flex-wrap">
        <div>
          <h3 className="m-0">Logins today</h3>
          <p className="mt-1 text-sm text-[var(--xf-text-muted)]">
            Successful sign-ins since midnight in your local timezone ({dayLabel}). Failed attempts stay on{" "}
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
          <Link className="cta cta-primary" href={loginAuditTodayHref()}>
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
              <th>User</th>
              <th>Provider</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-[var(--xf-text-muted)]">
                  No successful logins recorded today yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id ?? `${row.createdAt}-${row.clientIp ?? ""}-${row.email ?? ""}`}>
                  <td className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                  <td
                    className="max-w-[280px] truncate font-mono text-xs"
                    title={[row.email, row.username, row.userId].filter(Boolean).join(" · ") || undefined}
                  >
                    {row.email ?? row.username ?? row.userId ?? "—"}
                  </td>
                  <td>{row.provider}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{row.clientIp ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
