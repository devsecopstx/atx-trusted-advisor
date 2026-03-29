"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RRuleScheduleBuilderModal } from "@/app/admin/tasks/ui/rrule-schedule-builder-modal";
import { AddIcon, DeleteIcon, RefreshIcon, RunIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import {
    SCHEDULED_TASK_CATEGORIES,
    SCHEDULED_TASK_CATEGORY_DEFAULT_CRON
} from "@/lib/scheduled-task-category-schema";
import type { ScheduledTask as ScheduledTaskDoc } from "@/modules/core-admin/types";

type ScheduledTask = {
  _id?: string;
  name: string;
  category: ScheduledTaskDoc["category"];
  scheduleCron?: string;
  scheduleRRule?: string;
  scheduleDescription?: string;
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

type SchedulePayload = {
  scheduleCron?: string;
  scheduleRRule?: string;
  scheduleDescription?: string;
};

const POLL_INTERVAL_MS = 30_000;

const CATEGORIES = [...SCHEDULED_TASK_CATEGORIES];

type JobDefinition = {
  jobType: ScheduledTaskDoc["category"];
  jobName: string;
  title: string;
  description: string;
};

const PRIMARY_JOB_DEFINITIONS: JobDefinition[] = [
  {
    jobType: "price_scanner",
    jobName: "price-scanner-job",
    title: "price-scanner-job",
    description:
      "Reads portfolios, holdings, and watchlists, fetches Yahoo prices, and updates tenant_market_calendar during market window."
  },
  {
    jobType: "options_scanner",
    jobName: "options-scanner-job",
    title: "options-scanner-job",
    description: "Runs options strategy scanner checks and emits scanner run audit details."
  },
  {
    jobType: "user_access_requests",
    jobName: "user-access-request-job",
    title: "user-access-request-job",
    description:
      "Monitors access request queue health (actionable backlog + recent approvals) for admin operations."
  }
];
const CREATE_JOB_OPTIONS = PRIMARY_JOB_DEFINITIONS.map((job) => job.jobType);

const JOB_TYPE_LABELS: Record<ScheduledTaskDoc["category"], string> = {
  price_scanner: "price_scanner",
  options_scanner: "options_scanner",
  user_access_requests: "user_access_requests",
  "sync-broker": "sync-broker",
  rebalance: "rebalance",
  compliance: "compliance",
  notifications: "notifications",
  "user-history": "user-history",
  watchlist_price_scanner: "watchlist_price_scanner (legacy)",
  daily_options_scanner: "daily_options_scanner (legacy)"
};

const TASKS_BASE = "/api/admin/tasks";

function buildSchedulePayload(schedule: SchedulePayload) {
  return {
    schedule: {
      cron: schedule.scheduleCron,
      rrule: schedule.scheduleRRule,
      description: schedule.scheduleDescription
    }
  };
}

export function TasksConsole() {
  const [activePanel, setActivePanel] = useState<"jobs" | "task-runs">("jobs");
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [createJobType, setCreateJobType] = useState<ScheduledTaskDoc["category"]>("price_scanner");
  const [createSchedule, setCreateSchedule] = useState<{
    scheduleCron?: string;
    scheduleRRule?: string;
    scheduleDescription?: string;
  }>({
    scheduleCron: SCHEDULED_TASK_CATEGORY_DEFAULT_CRON.price_scanner
  });
  const [cronBuilder, setCronBuilder] = useState<{
    mode: "create" | "edit";
    taskId?: string;
    title: string;
    schedule: {
      scheduleCron?: string;
      scheduleRRule?: string;
      scheduleDescription?: string;
    };
  } | null>(null);
  const [edits, setEdits] = useState<
    Record<
      string,
      Partial<
        Pick<
          ScheduledTask,
          "name" | "category" | "scheduleCron" | "scheduleRRule" | "scheduleDescription" | "enabled"
        >
      >
    >
  >({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedCreateDefinition = useMemo(
    () => PRIMARY_JOB_DEFINITIONS.find((j) => j.jobType === createJobType) ?? PRIMARY_JOB_DEFINITIONS[0],
    [createJobType]
  );

  const refreshTasks = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: ScheduledTask[] }>(await fetch(TASKS_BASE));
      setTasks(payload.data);
      setEdits({});
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to refresh jobs");
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

  async function createJob() {
    setLoading(true);
    setStatus("Creating job...");
    try {
      const jobName = selectedCreateDefinition?.jobName ?? "price-scanner-job";
      await parseJson(
        await fetch(TASKS_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: jobName,
            category: createJobType,
            ...buildSchedulePayload(createSchedule),
            enabled: true
          })
        })
      );
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create job");
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
      (d.scheduleRRule !== undefined && d.scheduleRRule !== row.scheduleRRule) ||
      (d.scheduleDescription !== undefined && d.scheduleDescription !== row.scheduleDescription) ||
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
            ...buildSchedulePayload(m),
            enabled: m.enabled
          })
        })
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setStatus("Saved job");
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
    if (!window.confirm(`Delete job "${row.name}"?`)) {
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
      setStatus("Job deleted");
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
              ...buildSchedulePayload(m),
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
      setStatus(`Saved ${targets.length} job(s)`);
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
    setStatus(`Running job ${taskId}...`);
    try {
      const payload = await parseJson<{
        data: { runId: string; status: string; output: string };
      }>(await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}/run`, { method: "POST" }));
      setStatus(`Job finished: ${payload.data.status}`);
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to run job");
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
        <div className="tool-row" style={{ gap: "0.5rem", marginBottom: "0.85rem" }}>
          <button
            type="button"
            className={`tiny-button ${activePanel === "jobs" ? "cta cta-primary" : ""}`}
            onClick={() => setActivePanel("jobs")}
            disabled={loading}
          >
            Jobs
          </button>
          <button
            type="button"
            className={`tiny-button ${activePanel === "task-runs" ? "cta cta-primary" : ""}`}
            onClick={() => setActivePanel("task-runs")}
            disabled={loading}
          >
            Task Runs
          </button>
        </div>

        {activePanel === "jobs" ? (
          <div className="stack-gap">
            <h3>Predefined Jobs</h3>
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Configure jobs, then assign cron schedules. Portfolio-scoped jobs still live under each portfolio&apos;s
              manage → Tasks.
            </p>
            <div className="crud-table-wrap" style={{ marginBottom: "0.75rem" }}>
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Job Type</th>
                    <th>Description</th>
                    <th>Default Cron</th>
                    <th>Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {PRIMARY_JOB_DEFINITIONS.map((job) => (
                    <tr key={job.jobType}>
                      <td>{job.title}</td>
                      <td>
                        <code className="font-mono text-xs">{job.jobType}</code>
                      </td>
                      <td>{job.description}</td>
                      <td>
                        <code className="font-mono text-xs">
                          {SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[job.jobType]}
                        </code>
                      </td>
                      <td>
                        <button
                          className="tiny-button"
                          disabled={loading}
                          onClick={() => {
                            setCreateJobType(job.jobType);
                            setCreateSchedule({
                              scheduleCron: SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[job.jobType],
                              scheduleRRule: undefined,
                              scheduleDescription: undefined
                            });
                          }}
                          type="button"
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Create Job Schedule</h3>
            <div className="stack-form">
              <select
                name="jobType"
                value={createJobType}
                disabled={loading}
                onChange={(event) => {
                  const nextType = event.currentTarget.value as ScheduledTaskDoc["category"];
                  setCreateJobType(nextType);
              setCreateSchedule({
                scheduleCron: SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[nextType],
                scheduleRRule: undefined,
                scheduleDescription: undefined
              });
                }}
              >
                {CREATE_JOB_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {JOB_TYPE_LABELS[c]}
                  </option>
                ))}
              </select>
              <p className="status-text">
                Job name: <code className="font-mono text-xs">{selectedCreateDefinition?.jobName}</code>
              </p>
              <p className="status-text">
                Schedule:{" "}
                <code className="font-mono text-xs">
                  {createSchedule.scheduleDescription ??
                    createSchedule.scheduleRRule ??
                    createSchedule.scheduleCron ??
                    "not set"}
                </code>
              </p>
          <button
            className="tiny-button"
            type="button"
            disabled={loading}
            onClick={() =>
              setCronBuilder({
                mode: "create",
                title: "Create Job Schedule",
                    schedule: createSchedule
              })
            }
          >
            Open RRULE Builder
          </button>
              <button
                className="cta cta-primary"
                type="button"
                disabled={loading}
                onClick={() => void createJob()}
              >
                <AddIcon className="crud-icon" /> Create job schedule
              </button>
            </div>

            <h3>Jobs ({tasks.length})</h3>
            {tasks.length > 0 ? (
              <div className="crud-table-wrap">
                <table className="crud-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Job Type</th>
                      <th>Schedule</th>
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
                                  {JOB_TYPE_LABELS[c]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="crud-input font-mono text-xs"
                              disabled={loading}
                              value={m.scheduleCron ?? ""}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...prev[id],
                                    scheduleCron: e.target.value,
                                    scheduleRRule: undefined,
                                    scheduleDescription: undefined
                                  }
                                }))
                              }
                            />
                            <p className="status-text" style={{ marginTop: "0.25rem" }}>
                              {m.scheduleDescription ?? m.scheduleRRule ?? "Custom schedule"}
                            </p>
                            <button
                              className="tiny-button"
                              style={{ marginTop: "0.35rem" }}
                              disabled={loading}
                          onClick={() =>
                            setCronBuilder({
                              mode: "edit",
                              taskId: id,
                              title: `Edit Schedule — ${m.name}`,
                                  schedule: {
                                    scheduleCron: m.scheduleCron,
                                    scheduleRRule: m.scheduleRRule,
                                    scheduleDescription: m.scheduleDescription
                                  }
                            })
                          }
                              type="button"
                            >
                          RRULE Builder
                            </button>
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
              <p className="status-text">No jobs yet. Create one above.</p>
            )}
          </div>
        ) : (
          <div className="stack-gap">
            <h3>Task Runs ({runs.length})</h3>
            {runs.length > 0 ? (
              <div className="crud-table-wrap">
                <table className="crud-table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Job Type</th>
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
                        <td>{JOB_TYPE_LABELS[run.category as ScheduledTaskDoc["category"]] ?? run.category}</td>
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
              <p className="status-text">No task runs yet.</p>
            )}
          </div>
        )}
      </article>
      <RRuleScheduleBuilderModal
        key={
          cronBuilder
            ? `${cronBuilder.mode}:${cronBuilder.taskId ?? "create"}:${cronBuilder.schedule.scheduleRRule ?? cronBuilder.schedule.scheduleCron ?? ""}`
            : "closed"
        }
        open={Boolean(cronBuilder)}
        title={cronBuilder?.title ?? "Schedule Builder"}
        initial={cronBuilder?.schedule ?? {}}
        disabled={loading}
        onClose={() => setCronBuilder(null)}
        onApply={(next) => {
          if (!cronBuilder) return;
          if (cronBuilder.mode === "create") {
            setCreateSchedule(next);
            setCronBuilder(null);
            return;
          }
          const id = cronBuilder.taskId;
          if (id) {
            setEdits((prev) => ({
              ...prev,
              [id]: {
                ...prev[id],
                scheduleCron: next.scheduleCron,
                scheduleRRule: next.scheduleRRule,
                scheduleDescription: next.scheduleDescription
              }
            }));
          }
          setCronBuilder(null);
        }}
      />
    </section>
  );
}
