"use client";

import { useCallback, useEffect, useState } from "react";

import {
    TENANT_USER_SCHEDULED_TASK_CATEGORIES,
    TENANT_USER_TASK_SOFT_WARNING_THRESHOLD
} from "@/lib/tenant-user-scheduled-task-policy";
import type { TenantUserScheduledTaskJson } from "@/lib/tenant-user-scheduled-task-serialize";

type Meta = {
  enabledCount: number;
  maxTasks: number;
  softWarningThreshold: number;
};

type TaskRunRow = Record<string, unknown>;

type Props = {
  allowMutations: boolean;
};

export function TenantAutomationsClient({ allowMutations }: Props) {
  const [rows, setRows] = useState<TenantUserScheduledTaskJson[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [historyForId, setHistoryForId] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<TaskRunRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState<string>(TENANT_USER_SCHEDULED_TASK_CATEGORIES[0]);
  const [draftCron, setDraftCron] = useState("0 14 * * mon-fri");
  const [draftEnabled, setDraftEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant-tasks");
      const json = (await res.json().catch(() => ({}))) as {
        data?: TenantUserScheduledTaskJson[];
        meta?: Meta;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load automations");
      }
      setRows(json.data ?? []);
      setMeta(json.meta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadHistory(taskId: string) {
    setHistoryLoading(true);
    setHistoryRows([]);
    try {
      const res = await fetch(`/api/tenant-tasks/${encodeURIComponent(taskId)}/runs?limit=25`);
      const json = (await res.json().catch(() => ({}))) as { data?: TaskRunRow[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load history");
      }
      setHistoryRows(json.data ?? []);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "History failed");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function toggleEnabled(task: TenantUserScheduledTaskJson, enabled: boolean) {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/tenant-tasks/${encodeURIComponent(task._id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Update failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function runNow(id: string) {
    setRunningId(id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/tenant-tasks/${encodeURIComponent(id)}/run`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { output?: string; status?: string };
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Run failed");
      }
      setNotice(json.data?.output?.slice(0, 280) ?? "Started.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunningId(null);
    }
  }

  async function deleteTask(id: string) {
    if (!globalThis.confirm?.("Delete this automation?")) {
      return;
    }
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/tenant-tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Delete failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function createTask() {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/tenant-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          category: draftCategory,
          scheduleCron: draftCron.trim(),
          enabled: draftEnabled
        })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Create failed");
      }
      setFormOpen(false);
      setDraftName("");
      setDraftCron("0 14 * * mon-fri");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  const max = meta?.maxTasks ?? 5;
  const enabledCount = meta?.enabledCount ?? 0;
  const softAt = meta?.softWarningThreshold ?? TENANT_USER_TASK_SOFT_WARNING_THRESHOLD;
  const warnSoft = enabledCount >= softAt && enabledCount < max;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,transparent)] p-6 shadow-sm backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--xf-gain-green)]">
          Workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--xf-text-100)]">Automations</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--xf-text-300)]">
          Tenant-scoped scheduled jobs (watchlist price scan, options scanner, notifications). Runs on the same
          scheduler backbone as Admin → Tasks; capped for predictable load.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              enabledCount >= max
                ? "bg-[color-mix(in_srgb,var(--xf-danger,_#ef4444)_22%,transparent)] text-[var(--xf-text-100)]"
                : warnSoft
                  ? "bg-[color-mix(in_srgb,var(--xf-lightning-yellow)_18%,transparent)] text-[var(--xf-text-100)]"
                  : "bg-[color-mix(in_srgb,var(--xf-gain-green)_14%,transparent)] text-[var(--xf-text-100)]"
            }`}
          >
            {enabledCount}/{max} active automations
          </span>
          {warnSoft && enabledCount < max ? (
            <span className="text-xs text-[var(--xf-text-300)]">
              Approaching limit — consider consolidating schedules.
            </span>
          ) : null}
          {enabledCount >= max ? (
            <span className="text-xs text-[var(--xf-text-300)]">
              Limit reached. Disable or delete a task to add another.
            </span>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--xf-danger,_#ef4444)_35%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_90%,transparent)] px-4 py-3 text-sm text-[var(--xf-text-100)]">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--xf-gain-green)_25%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_90%,transparent)] px-4 py-3 text-sm text-[var(--xf-text-200)]">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-[var(--xf-gain-green)] px-4 py-2 text-sm font-semibold text-[var(--xf-bg-950,_#020617)] disabled:opacity-40"
          disabled={!allowMutations || enabledCount >= max}
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? "Close form" : "New automation"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] px-4 py-2 text-sm text-[var(--xf-text-200)]"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>

      {formOpen && allowMutations ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,transparent)] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--xf-text-100)]">Create automation</h2>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Name</span>
            <input
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-bg-950,_#020617)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="e.g. Daily watchlist IV check"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Type</span>
            <select
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-bg-950,_#020617)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
            >
              {TENANT_USER_SCHEDULED_TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">
              Cron (UTC, 5-field)
            </span>
            <input
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-bg-950,_#020617)] px-3 py-2 font-mono text-sm text-[var(--xf-text-100)]"
              value={draftCron}
              onChange={(e) => setDraftCron(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--xf-text-200)]">
            <input type="checkbox" checked={draftEnabled} onChange={(e) => setDraftEnabled(e.target.checked)} />
            Enabled
          </label>
          <button
            type="button"
            className="rounded-lg bg-[var(--xf-gain-green)] px-4 py-2 text-sm font-semibold text-[var(--xf-bg-950,_#020617)]"
            onClick={() => void createTask()}
          >
            Save
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)]">
        <table className="min-w-full divide-y divide-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] text-sm">
          <thead className="bg-[color-mix(in_srgb,var(--xf-bg-900)_95%,transparent)] text-left text-[var(--xf-text-400)]">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Next run</th>
              <th className="px-4 py-3 font-medium">Last run</th>
              <th className="px-4 py-3 font-medium">On</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] text-[var(--xf-text-200)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--xf-text-400)]">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--xf-text-400)]">
                  No tenant automations yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} className="bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,transparent)]">
                  <td className="px-4 py-3 font-medium text-[var(--xf-text-100)]">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.category}</td>
                  <td className="px-4 py-3 text-xs">{r.nextRunAt ? new Date(r.nextRunAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-xs">{r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      disabled={!allowMutations}
                      onChange={(e) => void toggleEnabled(r, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-[var(--xf-gain-green)] disabled:opacity-40"
                      disabled={!allowMutations || runningId === r._id}
                      onClick={() => void runNow(r._id)}
                    >
                      Run now
                    </button>
                    <button
                      type="button"
                      className="text-[var(--xf-text-300)]"
                      onClick={() => {
                        setHistoryForId(r._id);
                        void loadHistory(r._id);
                      }}
                    >
                      History
                    </button>
                    <button
                      type="button"
                      className="text-[color-mix(in_srgb,var(--xf-danger,_#ef4444)_90%,transparent)] disabled:opacity-40"
                      disabled={!allowMutations}
                      onClick={() => void deleteTask(r._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {historyForId ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,transparent)] p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--xf-text-100)]">Run history</h3>
            <button
              type="button"
              className="text-sm text-[var(--xf-text-400)]"
              onClick={() => {
                setHistoryForId(null);
                setHistoryRows([]);
              }}
            >
              Close
            </button>
          </div>
          {historyLoading ? (
            <p className="text-sm text-[var(--xf-text-400)]">Loading…</p>
          ) : (
            <ul className="space-y-2 text-xs font-mono text-[var(--xf-text-300)]">
              {historyRows.map((row, i) => (
                <li
                  key={`${String(row._id ?? i)}`}
                  className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] p-2"
                >
                  <div className="flex flex-wrap gap-2 text-[var(--xf-text-200)]">
                    <span>{String(row.startedAt ?? "")}</span>
                    <span>{String(row.status ?? "")}</span>
                    <span>{String(row.triggeredBy ?? "")}</span>
                  </div>
                  <div className="mt-1 text-[var(--xf-text-400)] break-all">
                    {String(row.output ?? "").slice(0, 400)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
