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

import { PortfolioManageNav } from "./portfolio-manage-nav";

type ScheduledTaskRow = {
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

const CATEGORIES = [...SCHEDULED_TASK_CATEGORIES];
const POLL_INTERVAL_MS = 30_000;

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

function buildSchedulePayload(schedule: SchedulePayload) {
  return {
    schedule: {
      cron: schedule.scheduleCron,
      rrule: schedule.scheduleRRule,
      description: schedule.scheduleDescription
    }
  };
}

export function AdminPortfolioTasksConsole({ portfolioId }: { portfolioId: string }) {
  const [activePanel, setActivePanel] = useState<"jobs" | "task-runs">("jobs");
  const [tasks, setTasks] = useState<ScheduledTaskRow[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [edits, setEdits] = useState<
    Record<
      string,
      Partial<
        Pick<
          ScheduledTaskRow,
          "name" | "category" | "scheduleCron" | "scheduleRRule" | "scheduleDescription" | "enabled"
        >
      >
    >
  >({});
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedCreateDefinition = useMemo(
    () => PRIMARY_JOB_DEFINITIONS.find((j) => j.jobType === createJobType) ?? PRIMARY_JOB_DEFINITIONS[0],
    [createJobType]
  );

  const base = `/api/admin/portfolios/${encodeURIComponent(portfolioId)}/tasks`;

  const refreshTasks = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: ScheduledTaskRow[] }>(await fetch(base, { cache: "no-store" }));
      setTasks(payload.data);
      setEdits({});
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load jobs");
      setTasks([]);
    }
  }, [base]);

  const refreshRuns = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: TaskRun[] }>(await fetch("/api/admin/task-runs", { cache: "no-store" }));
      setRuns(payload.data);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load task runs");
      setRuns([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setStatus("Loading…");
    await Promise.all([refreshTasks(), refreshRuns()]);
    setStatus("Synced");
    setLoading(false);
  }, [refreshRuns, refreshTasks]);

  useEffect(() => {
    void refreshAll();
    pollRef.current = setInterval(() => {
      void refreshAll();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [refreshAll]);

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
      (d.scheduleRRule !== undefined && d.scheduleRRule !== row.scheduleRRule) ||
      (d.scheduleDescription !== undefined && d.scheduleDescription !== row.scheduleDescription) ||
      (d.enabled !== undefined && d.enabled !== row.enabled)
    );
  };

  const hasAnyDirty = tasks.some((t) => rowDirty(t));

  async function createJob() {
    setLoading(true);
    setStatus("Creating job…");
    try {
      const jobName = selectedCreateDefinition?.jobName ?? "price-scanner-job";
      await parseJson(
        await fetch(base, {
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
      setStatus("Job created");
      await refreshAll();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create job");
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

  const deleteRow = async (row: ScheduledTaskRow) => {
    const id = row._id;
    if (!id) return;
    if (!window.confirm(`Delete job "${row.name}"?`)) {
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
      setStatus("Job deleted");
      await refreshAll();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const runTask = async (taskId: string | undefined) => {
    if (!taskId) return;
    setRunningTaskId(taskId);
    setStatus(`Running job ${taskId}…`);
    try {
      const payload = await parseJson<{
        data: { runId: string; status: string; output: string };
      }>(await fetch(`/api/admin/tasks/${encodeURIComponent(taskId)}/run`, { method: "POST" }));
      setStatus(`Job finished: ${payload.data.status}`);
      await refreshAll();
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

  const portfolioTaskIdSet = useMemo(() => {
    return new Set(tasks.map((task) => task._id).filter((id): id is string => Boolean(id)));
  }, [tasks]);
  const portfolioRuns = useMemo(() => {
    return runs.filter((run) => portfolioTaskIdSet.has(run.taskId));
  }, [portfolioTaskIdSet, runs]);

  return (
    <section className="panel stack-gap">
      <PortfolioManageNav portfolioId={portfolioId} active="tasks">
        <button type="button" className="cta cta-primary" disabled={loading || !hasAnyDirty} onClick={() => void saveAllDirty()}>
          <SaveIcon className="crud-icon" /> Save changes
        </button>
        <button type="button" className="cta cta-secondary" disabled={loading} onClick={() => void refreshAll()}>
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </PortfolioManageNav>

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
            <h3>Predefined Jobs (this portfolio)</h3>
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Jobs created here are stored with <code className="font-mono text-xs">portfolioId</code> and scoped to
              this book.
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
              <button className="cta cta-primary" type="button" disabled={loading} onClick={() => void createJob()}>
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
                              disabled={loading}
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
                              disabled={loading}
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
                                  {JOB_TYPE_LABELS[c]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="crud-input font-mono text-xs"
                              value={m.scheduleCron ?? ""}
                              disabled={loading}
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
                                disabled={loading || runningTaskId === id}
                                onClick={() => void runTask(id)}
                              >
                                <RunIcon className="crud-icon" />{" "}
                                {runningTaskId === id ? "…" : "Run"}
                              </button>
                              <button
                                type="button"
                                className="tiny-button"
                                disabled={loading}
                                onClick={() => void deleteRow(row)}
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
              <p className="status-text">No portfolio-scoped jobs yet.</p>
            )}
          </div>
        ) : (
          <div className="stack-gap">
            <h3>Task Runs ({portfolioRuns.length})</h3>
            {portfolioRuns.length > 0 ? (
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
                    {portfolioRuns.map((run) => (
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
              <p className="status-text">No task runs for this portfolio yet.</p>
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
