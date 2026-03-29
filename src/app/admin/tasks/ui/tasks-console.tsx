"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon, RunIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { SCHEDULED_TASK_CATEGORIES } from "@/lib/scheduled-task-category-schema";
import type { ScheduledTask as ScheduledTaskDoc } from "@/modules/core-admin/types";

type ScheduledTask = {
  _id?: string;
  name: string;
  category: ScheduledTaskDoc["category"];
  scheduleCron: string;
  enabled: boolean;
  nextRunAt?: string;
};

type TaskRun = {
  _id?: string;
  taskId: string;
  taskName: string;
  category: string;
  triggeredBy: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output: string;
};

const POLL_INTERVAL_MS = 30_000;

const CATEGORIES = [...SCHEDULED_TASK_CATEGORIES];

const TASKS_BASE = "/api/admin/tasks";

export function TasksConsole() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [edits, setEdits] = useState<
    Record<string, Partial<Pick<ScheduledTask, "name" | "category" | "scheduleCron" | "enabled">>>
  >({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: ScheduledTask[] }>(await fetch(TASKS_BASE));
      setTasks(payload.data);
      setEdits({});
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to refresh tasks");
    }
  }, []);

  const refreshRuns = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: TaskRun[] }>(await fetch("/api/admin/task-runs"));
      setRuns(payload.data);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to refresh runs");
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setStatus("Syncing...");
    await Promise.all([refreshTasks(), refreshRuns()]);
    setStatus("Synced");
  }, [refreshTasks, refreshRuns]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    setStatus("Creating task...");
    try {
      await parseJson(
        await fetch(TASKS_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(formData.get("name") ?? ""),
            category: String(formData.get("category") ?? ""),
            scheduleCron: String(formData.get("scheduleCron") ?? ""),
            enabled: true
          })
        })
      );
      form.reset();
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  const draft = (id: string) => edits[id] ?? {};

  const mergeRow = (row: ScheduledTask): ScheduledTask => ({
    ...row,
    ...draft(row._id ?? "")
  });

  const rowDirty = (row: ScheduledTask): boolean => {
    const d = draft(row._id ?? "");
    return (
      (d.name !== undefined && d.name !== row.name) ||
      (d.category !== undefined && d.category !== row.category) ||
      (d.scheduleCron !== undefined && d.scheduleCron !== row.scheduleCron) ||
      (d.enabled !== undefined && d.enabled !== row.enabled)
    );
  };

  const hasAnyDirty = tasks.some((t) => rowDirty(t));

  const saveRow = async (row: ScheduledTask) => {
    const id = row._id;
    if (!id || !rowDirty(row)) {
      return;
    }
    const m = mergeRow(row);
    setLoading(true);
    setStatus("Saving…");
    try {
      await parseJson(
        await fetch(`${TASKS_BASE}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: m.name,
            category: m.category,
            scheduleCron: m.scheduleCron,
            enabled: m.enabled
          })
        })
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setStatus("Saved task");
      await refreshAll();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (row: ScheduledTask) => {
    const id = row._id;
    if (!id) return;
    if (!window.confirm(`Delete scheduled task "${row.name}"?`)) {
      return;
    }
    setLoading(true);
    setStatus("Deleting…");
    try {
      await parseJson(
        await fetch(`${TASKS_BASE}/${encodeURIComponent(id)}`, {
          method: "DELETE"
        })
      );
      setStatus("Task deleted");
      await refreshAll();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAllDirty = async () => {
    const targets = tasks.filter((t) => t._id && rowDirty(t));
    if (targets.length === 0) {
      setStatus("No changes");
      return;
    }
    setLoading(true);
    setStatus("Saving all…");
    try {
      for (const row of targets) {
        const id = row._id!;
        const m = mergeRow(row);
        await parseJson(
          await fetch(`${TASKS_BASE}/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: m.name,
              category: m.category,
              scheduleCron: m.scheduleCron,
              enabled: m.enabled
            })
          })
        );
        setEdits((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      setStatus(`Saved ${targets.length} task(s)`);
      await refreshAll();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  async function runTask(taskId: string | undefined) {
    if (!taskId) return;
    setRunningTaskId(taskId);
    setStatus(`Running task ${taskId}...`);
    try {
      const payload = await parseJson<{
        data: { runId: string; status: string; output: string };
      }>(await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}/run`, { method: "POST" }));
      setStatus(`Task finished: ${payload.data.status}`);
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to run task");
    } finally {
      setRunningTaskId(null);
    }
  }

  useEffect(() => {
    void refreshAll();
    pollRef.current = setInterval(() => {
      void refreshAll();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshAll]);

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button
          className="cta cta-primary"
          disabled={loading || !hasAnyDirty}
          onClick={() => void saveAllDirty()}
          type="button"
        >
          <SaveIcon className="crud-icon" /> Save changes
        </button>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refreshAll()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Create task</h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          Tenant-level jobs (no <code className="font-mono text-xs">portfolioId</code>). Portfolio-scoped tasks live
          under each portfolio&apos;s manage → Tasks.
        </p>
        <form className="stack-form" onSubmit={createTask}>
          <input name="name" placeholder="task name" required disabled={loading} />
          <select name="category" defaultValue="sync-broker" disabled={loading}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input name="scheduleCron" placeholder="0 2 * * *" required disabled={loading} />
          <button className="cta cta-primary" type="submit" disabled={loading}>
            <AddIcon className="crud-icon" /> Create task
          </button>
        </form>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Tasks ({tasks.length})</h3>
        {tasks.length > 0 ? (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Cron</th>
                  <th>Enabled</th>
                  <th>Next Run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((row) => {
                  const id = row._id ?? "";
                  const m = mergeRow(row);
                  const dirty = rowDirty(row);
                  return (
                    <tr key={id || m.name}>
                      <td>
                        <input
                          className="crud-input text-sm"
                          disabled={loading}
                          value={m.name}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [id]: { ...prev[id], name: e.target.value }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="crud-input text-xs"
                          disabled={loading}
                          value={m.category}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [id]: {
                                ...prev[id],
                                category: e.target.value as ScheduledTask["category"]
                              }
                            }))
                          }
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="crud-input font-mono text-xs"
                          disabled={loading}
                          value={m.scheduleCron}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [id]: { ...prev[id], scheduleCron: e.target.value }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          disabled={loading}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [id]: { ...prev[id], enabled: e.target.checked }
                            }))
                          }
                        />
                      </td>
                      <td>{row.nextRunAt ? new Date(row.nextRunAt).toLocaleString() : "—"}</td>
                      <td>
                        <div className="tool-row" style={{ gap: "0.25rem", flexWrap: "wrap" }}>
                          <button
                            className="tiny-button"
                            disabled={loading || !dirty}
                            onClick={() => void saveRow(row)}
                            type="button"
                          >
                            Save
                          </button>
                          <button
                            className="tiny-button"
                            disabled={loading || runningTaskId === id}
                            onClick={() => void runTask(row._id)}
                            type="button"
                          >
                            <RunIcon className="crud-icon" />{" "}
                            {runningTaskId === id ? "Running..." : "Run"}
                          </button>
                          <button
                            className="tiny-button"
                            disabled={loading}
                            onClick={() => void deleteRow(row)}
                            type="button"
                          >
                            <DeleteIcon className="crud-icon" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="status-text">No tasks yet. Create one above.</p>
        )}
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Recent Runs ({runs.length})</h3>
        {runs.length > 0 ? (
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Triggered By</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run._id ?? run.startedAt}>
                    <td>{run.taskName}</td>
                    <td>{run.category}</td>
                    <td>
                      <span
                        className={`status-badge status-${run.status === "success" ? "ready" : run.status === "failed" ? "error" : "pending"}`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td>{run.triggeredBy}</td>
                    <td>{new Date(run.startedAt).toLocaleString()}</td>
                    <td>{run.durationMs != null ? `${run.durationMs}ms` : "—"}</td>
                    <td className="output-cell">{run.output || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="status-text">No task runs yet. Run a task to see results here.</p>
        )}
      </article>
    </section>
  );
}
