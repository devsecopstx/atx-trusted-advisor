"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AddIcon, DeleteIcon, RefreshIcon, RunIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { SCHEDULED_TASK_CATEGORIES } from "@/lib/scheduled-task-category-schema";
import type { ScheduledTask as ScheduledTaskDoc } from "@/modules/core-admin/types";

import { PortfolioManageNav } from "./portfolio-manage-nav";

type ScheduledTaskRow = {
  _id?: string;
  name: string;
  category: ScheduledTaskDoc["category"];
  scheduleCron: string;
  enabled: boolean;
  nextRunAt?: string;
};

const CATEGORIES = [...SCHEDULED_TASK_CATEGORIES];

export function AdminPortfolioTasksConsole({ portfolioId }: { portfolioId: string }) {
  const [tasks, setTasks] = useState<ScheduledTaskRow[]>([]);
  const [edits, setEdits] = useState<
    Record<
      string,
      Partial<Pick<ScheduledTaskRow, "name" | "category" | "scheduleCron" | "enabled">>
    >
  >({});
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  const base = `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/tasks`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    try {
      const payload = await parseJson<{ data: ScheduledTaskRow[] }>(await fetch(base, { cache: "no-store" }));
      setTasks(payload.data);
      setEdits({});
      setStatus(`Loaded ${payload.data.length} task(s) for this portfolio`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const draft = (id: string) => edits[id] ?? {};

  const mergeRow = (row: ScheduledTaskRow): ScheduledTaskRow => ({
    ...row,
    ...draft(row._id ?? "")
  });

  const rowDirty = (row: ScheduledTaskRow): boolean => {
    const d = draft(row._id ?? "");
    return (
      (d.name !== undefined && d.name !== row.name) ||
      (d.category !== undefined && d.category !== row.category) ||
      (d.scheduleCron !== undefined && d.scheduleCron !== row.scheduleCron) ||
      (d.enabled !== undefined && d.enabled !== row.enabled)
    );
  };

  const hasAnyDirty = tasks.some((t) => rowDirty(t));

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    setStatus("Creating task…");
    try {
      await parseJson(
        await fetch(base, {
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
      setStatus("Task created");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  const saveRow = async (row: ScheduledTaskRow) => {
    const id = row._id;
    if (!id || !rowDirty(row)) {
      return;
    }
    const m = mergeRow(row);
    setLoading(true);
    setStatus("Saving…");
    try {
      await parseJson(
        await fetch(`${base}/${encodeURIComponent(id)}`, {
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
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteRow = async (row: ScheduledTaskRow) => {
    const id = row._id;
    if (!id) return;
    if (!window.confirm(`Delete scheduled task "${row.name}"?`)) {
      return;
    }
    setLoading(true);
    setStatus("Deleting…");
    try {
      await parseJson(
        await fetch(`${base}/${encodeURIComponent(id)}`, {
          method: "DELETE"
        })
      );
      setStatus("Task deleted");
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const runTask = async (taskId: string | undefined) => {
    if (!taskId) return;
    setRunningTaskId(taskId);
    setStatus(`Running task ${taskId}…`);
    try {
      const payload = await parseJson<{
        data: { runId: string; status: string; output: string };
      }>(await fetch(`/api/admin/tasks/${encodeURIComponent(taskId)}/run`, { method: "POST" }));
      setStatus(`Task finished: ${payload.data.status}`);
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunningTaskId(null);
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
          await fetch(`${base}/${encodeURIComponent(id)}`, {
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
      void refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel stack-gap">
      <PortfolioManageNav portfolioId={portfolioId} active="tasks">
        <button type="button" className="cta cta-primary" disabled={loading || !hasAnyDirty} onClick={() => void saveAllDirty()}>
          <SaveIcon className="crud-icon" /> Save changes
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void refresh()}>
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

      <article className="surface-card xf-widget section-card">
        <h3>Create task (this portfolio)</h3>
        <p className="status-text" style={{ marginBottom: "0.65rem" }}>
          New tasks are stored with <code className="font-mono text-xs">portfolioId</code> so they only appear here and
          in scheduler runs for this book.
        </p>
        <form className="stack-form" onSubmit={createTask}>
          <input name="name" placeholder="task name" required />
          <select name="category" defaultValue="sync-broker">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input name="scheduleCron" placeholder="0 2 * * *" required />
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
                  <th>Next run</th>
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
                          value={m.category}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [id]: {
                                ...prev[id],
                                category: e.target.value as ScheduledTaskRow["category"]
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
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [id]: { ...prev[id], enabled: e.target.checked }
                            }))
                          }
                        />
                      </td>
                      <td className="text-xs">{m.nextRunAt ? new Date(m.nextRunAt).toLocaleString() : "—"}</td>
                      <td>
                        <div className="tool-row" style={{ gap: "0.25rem", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="tiny-button"
                            disabled={loading || !dirty}
                            onClick={() => void saveRow(row)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="tiny-button"
                            disabled={runningTaskId === id}
                            onClick={() => void runTask(id)}
                          >
                            <RunIcon className="crud-icon" />{" "}
                            {runningTaskId === id ? "…" : "Run"}
                          </button>
                          <button type="button" className="tiny-button" onClick={() => void deleteRow(row)}>
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
          <p className="status-text">No portfolio-scoped tasks yet.</p>
        )}
      </article>
    </section>
  );
}
