"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";

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

type Filters = {
  outcome: "" | "success" | "failure";
  clientIp: string;
  from: string;
  to: string;
  limit: string;
};

const DEFAULT_FILTERS: Filters = {
  outcome: "",
  clientIp: "",
  from: "",
  to: "",
  limit: "200"
};

export function LoginAuditConsole() {
  const [rows, setRows] = useState<LoginAuditRow[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [status, setStatus] = useState("Ready — load recent login attempts");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.outcome) {
      params.set("outcome", filters.outcome);
    }
    if (filters.clientIp.trim()) {
      params.set("clientIp", filters.clientIp.trim());
    }
    if (filters.from.trim()) {
      params.set("from", new Date(filters.from).toISOString());
    }
    if (filters.to.trim()) {
      params.set("to", new Date(filters.to).toISOString());
    }
    if (filters.limit.trim()) {
      params.set("limit", filters.limit.trim());
    }
    return params.toString();
  }, [filters]);

  const refreshRows = useCallback(async () => {
    setStatus("Loading login audit…");
    try {
      const path = queryString ? `/api/admin/login-audit?${queryString}` : "/api/admin/login-audit";
      const payload = await parseJson<{ data: LoginAuditRow[] }>(await fetch(path));
      setRows(payload.data);
      setStatus(`Loaded ${payload.data.length} rows`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load login audit");
    }
  }, [queryString]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshRows();
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="mt-8 space-y-6">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-lg border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-800)] p-4 md:flex-row md:flex-wrap md:items-end"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--xf-text-muted)]">Outcome</span>
          <select
            className="rounded border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-900)] px-2 py-1"
            value={filters.outcome}
            onChange={(e) => updateFilter("outcome", e.target.value as Filters["outcome"])}
          >
            <option value="">any</option>
            <option value="success">success</option>
            <option value="failure">failure</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
          <span className="text-[var(--xf-text-muted)]">Client IP</span>
          <input
            className="rounded border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-900)] px-2 py-1 font-mono text-xs"
            value={filters.clientIp}
            onChange={(e) => updateFilter("clientIp", e.target.value)}
            placeholder="exact match"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--xf-text-muted)]">From (local)</span>
          <input
            type="datetime-local"
            className="rounded border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-900)] px-2 py-1"
            value={filters.from}
            onChange={(e) => updateFilter("from", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--xf-text-muted)]">To (local)</span>
          <input
            type="datetime-local"
            className="rounded border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-900)] px-2 py-1"
            value={filters.to}
            onChange={(e) => updateFilter("to", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--xf-text-muted)]">Limit</span>
          <input
            className="w-24 rounded border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-900)] px-2 py-1"
            value={filters.limit}
            onChange={(e) => updateFilter("limit", e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="rounded bg-[var(--xf-gain-green)] px-4 py-2 text-sm font-semibold text-black"
        >
          Load
        </button>
      </form>

      <p className="text-sm text-[var(--xf-text-muted)]">{status}</p>

      <div className="overflow-x-auto rounded-lg border border-[var(--xf-border-subtle)]">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead className="bg-[var(--xf-surface-900)] font-mono uppercase tracking-wide text-[var(--xf-text-muted)]">
            <tr>
              <th className="border-b border-[var(--xf-border-subtle)] px-2 py-2">Time (UTC)</th>
              <th className="border-b border-[var(--xf-border-subtle)] px-2 py-2">Outcome</th>
              <th className="border-b border-[var(--xf-border-subtle)] px-2 py-2">Provider</th>
              <th className="border-b border-[var(--xf-border-subtle)] px-2 py-2">Error</th>
              <th className="border-b border-[var(--xf-border-subtle)] px-2 py-2">IP</th>
              <th className="border-b border-[var(--xf-border-subtle)] px-2 py-2">User / X</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[var(--xf-text-secondary)]">
            {rows.map((row) => (
              <tr key={row._id ?? row.createdAt + row.clientIp} className="border-b border-[var(--xf-border-subtle)]">
                <td className="whitespace-nowrap px-2 py-1">{row.createdAt}</td>
                <td
                  className={
                    row.outcome === "success" ? "text-[var(--xf-gain-green)]" : "text-red-400"
                  }
                >
                  {row.outcome}
                </td>
                <td className="px-2 py-1">{row.provider}</td>
                <td className="max-w-[200px] truncate px-2 py-1" title={row.errorCode}>
                  {row.errorCode ?? "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-1">{row.clientIp ?? "—"}</td>
                <td className="max-w-[280px] truncate px-2 py-1" title={[row.email, row.username, row.userId].filter(Boolean).join(" · ")}>
                  {[row.email, row.username, row.userId].filter(Boolean).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
