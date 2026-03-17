"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { AddIcon, RefreshIcon, RunIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type ScheduledTask = {
  _id?: string;
  name: string;
  category: "sync-broker" | "rebalance" | "compliance" | "notifications";
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

export function TasksConsole() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: ScheduledTask[] }>(await fetch("/api/admin/tasks"));
      setTasks(payload.data);
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
    const formData = new FormData(event.currentTarget);
    setStatus("Creating task...");
    try {
      await parseJson(
        await fetch("/api/admin/tasks", {
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
      event.currentTarget.reset();
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create task");
    }
  }

  async function runTask(taskId: string | undefined) {
    if (!taskId) return;
    setRunningTaskId(taskId);
    setStatus(`Running task ${taskId}...`);
    try {
      const payload = await parseJson<{
        data: { runId: string; status: string; output: string };
      }>(
        await fetch(`/api/admin/tasks/${taskId}/run`, { method: "POST" })
      );
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
        <button className="cta cta-secondary" onClick={() => void refreshAll()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Create Task</h3>
        <form className="stack-form" onSubmit={createTask}>
          <input name="name" placeholder="task name" required />
          <select name="category" defaultValue="sync-broker">
            <option value="sync-broker">sync-broker</option>
            <option value="rebalance">rebalance</option>
            <option value="compliance">compliance</option>
            <option value="notifications">notifications</option>
          </select>
          <input name="scheduleCron" placeholder="0 2 * * *" required />
          <button className="cta cta-primary" type="submit">
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
                {tasks.map((task) => (
                  <tr key={task._id ?? task.name}>
                    <td>{task.name}</td>
                    <td>{task.category}</td>
                    <td><code>{task.scheduleCron}</code></td>
                    <td>{task.enabled ? "Yes" : "No"}</td>
                    <td>{task.nextRunAt ? new Date(task.nextRunAt).toLocaleString() : "—"}</td>
                    <td>
                      <button
                        className="tiny-button"
                        disabled={runningTaskId === task._id}
                        onClick={() => void runTask(task._id)}
                        type="button"
                      >
                        <RunIcon className="crud-icon" />{" "}
                        {runningTaskId === task._id ? "Running..." : "Run"}
                      </button>
                    </td>
                  </tr>
                ))}
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
                      <span className={`status-badge status-${run.status === "success" ? "ready" : run.status === "failed" ? "error" : "pending"}`}>
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
