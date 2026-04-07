"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RRuleScheduleBuilderModal } from "@/app/admin/tasks/ui/rrule-schedule-builder-modal";
import { AddIcon, DeleteIcon, RefreshIcon, RunIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { SCHEDULED_TASK_CATEGORY_CATALOG } from "@/lib/scheduled-task-category-catalog";
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
  /** Admin delivery channel id (`admin_delivery_channels`), or unset. */
  deliveryChannelTarget?: string | null;
  nextRunAt?: string;
};

type DeliveryChannelRow = {
  _id: string;
  name: string;
  deliveryTarget: "in_app" | "slack" | "email";
  slackWebhookUrl: string;
  emailTo?: string;
  createdAt: string;
  updatedAt: string;
};

function formatSlackWebhookPreview(url: string): string {
  const t = url.trim();
  if (!t) return "—";
  if (t.length <= 48) return t;
  return `${t.slice(0, 28)}…${t.slice(-12)}`;
}

function formatEmailPreview(email: string): string {
  const t = email.trim();
  if (!t) return "—";
  if (t.length <= 40) return t;
  return `${t.slice(0, 22)}…${t.slice(-10)}`;
}

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

function defaultJobNameForCategory(category: ScheduledTaskDoc["category"]): string {
  return SCHEDULED_TASK_CATEGORY_CATALOG[category].defaultJobName;
}

const JOB_TYPE_LABELS: Record<ScheduledTaskDoc["category"], string> = Object.fromEntries(
  SCHEDULED_TASK_CATEGORIES.map((c) => [c, SCHEDULED_TASK_CATEGORY_CATALOG[c].displayName])
) as Record<ScheduledTaskDoc["category"], string>;

const TASKS_BASE = "/api/admin/tasks";
const DELIVERY_CHANNELS_BASE = "/api/admin/delivery-channels";

/** Builds PATCH/POST `schedule` object; omits null/empty so Zod never sees `null` (API JSON can include null from Mongo). */
function buildSchedulePayload(schedule: SchedulePayload) {
  const cron =
    schedule.scheduleCron != null && String(schedule.scheduleCron).trim() !== ""
      ? String(schedule.scheduleCron).trim()
      : undefined;
  const rrule =
    schedule.scheduleRRule != null && String(schedule.scheduleRRule).trim() !== ""
      ? String(schedule.scheduleRRule).trim()
      : undefined;
  const description =
    schedule.scheduleDescription != null && String(schedule.scheduleDescription).trim() !== ""
      ? String(schedule.scheduleDescription).trim()
      : undefined;

  if (cron === undefined && rrule === undefined && description === undefined) {
    return {};
  }
  return {
    schedule: {
      ...(cron !== undefined ? { cron } : {}),
      ...(rrule !== undefined ? { rrule } : {}),
      ...(description !== undefined ? { description } : {})
    }
  };
}

export function TasksConsole() {
  const [activeTab, setActiveTab] = useState<"tasks" | "schedule" | "runs" | "channels">("tasks");
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [deliveryChannels, setDeliveryChannels] = useState<DeliveryChannelRow[]>([]);
  const [status, setStatus] = useState("Ready — tap refresh");
  const [loading, setLoading] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [createJobType, setCreateJobType] = useState<ScheduledTaskDoc["category"]>("price_scanner");
  const [createDeliveryChannelTarget, setCreateDeliveryChannelTarget] = useState("");
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
          | "name"
          | "category"
          | "scheduleCron"
          | "scheduleRRule"
          | "scheduleDescription"
          | "enabled"
          | "deliveryChannelTarget"
        >
      >
    >
  >({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedCreateTemplate = useMemo(
    () => SCHEDULED_TASK_CATEGORY_CATALOG[createJobType],
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

  const refreshDeliveryChannels = useCallback(async () => {
    try {
      const payload = await parseJson<{ data: DeliveryChannelRow[] }>(
        await fetch(DELIVERY_CHANNELS_BASE, { cache: "no-store" })
      );
      setDeliveryChannels(payload.data);
    } catch {
      setDeliveryChannels([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setStatus("Syncing...");
    // Sequential fetches avoid tripping strict per-route / edge burst limits (vs 3 parallel).
    await refreshTasks();
    await refreshRuns();
    await refreshDeliveryChannels();
    setStatus("Synced");
  }, [refreshTasks, refreshRuns, refreshDeliveryChannels]);

  async function createJob() {
    setLoading(true);
    setStatus("Creating job...");
    try {
      const jobName = selectedCreateTemplate.defaultJobName;
      await parseJson(
        await fetch(TASKS_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: jobName,
            category: createJobType,
            ...buildSchedulePayload(createSchedule),
            enabled: true,
            ...(createDeliveryChannelTarget.trim()
              ? { deliveryChannelTarget: createDeliveryChannelTarget.trim() }
              : {})
          })
        })
      );
      await refreshAll();
      setActiveTab("tasks");
      setStatus("Created — see Tasks tab");
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
    const rowDct = row.deliveryChannelTarget ?? "";
    const draftDct = d.deliveryChannelTarget !== undefined ? (d.deliveryChannelTarget ?? "") : rowDct;
    return (
      (d.name !== undefined && d.name !== row.name) ||
      (d.category !== undefined && d.category !== row.category) ||
      (d.scheduleCron !== undefined && d.scheduleCron !== row.scheduleCron) ||
      (d.scheduleRRule !== undefined && d.scheduleRRule !== row.scheduleRRule) ||
      (d.scheduleDescription !== undefined && d.scheduleDescription !== row.scheduleDescription) ||
      (d.enabled !== undefined && d.enabled !== row.enabled) ||
      (d.deliveryChannelTarget !== undefined && draftDct !== rowDct)
    );
  };

  const hasAnyDirty = tasks.some((t) => rowDirty(t));

  const activeScheduledCount = useMemo(
    () => tasks.filter((t) => t.enabled).length,
    [tasks]
  );
  const runningJobsCount = useMemo(
    () => runs.filter((r) => r.status === "running").length,
    [runs]
  );
  const opsStatus = useMemo(() => {
    if (loading) {
      return { label: "Busy…", badgeClass: "status-badge status-pending" as const };
    }
    if (status === "Syncing...") {
      return { label: "Syncing…", badgeClass: "status-badge status-pending" as const };
    }
    if (runningJobsCount > 0) {
      return {
        label: `${runningJobsCount} job${runningJobsCount === 1 ? "" : "s"} running`,
        badgeClass: "status-badge status-live" as const
      };
    }
    return { label: "Idle", badgeClass: "status-badge status-ready" as const };
  }, [loading, runningJobsCount, status]);

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
            enabled: m.enabled,
            deliveryChannelTarget:
              m.deliveryChannelTarget === undefined || m.deliveryChannelTarget === ""
                ? null
                : m.deliveryChannelTarget
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
              enabled: m.enabled,
              deliveryChannelTarget:
                m.deliveryChannelTarget === undefined || m.deliveryChannelTarget === ""
                  ? null
                  : m.deliveryChannelTarget
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

      <div
        className="surface-card xf-widget section-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
          gap: "1rem",
          padding: "0.85rem 1rem"
        }}
      >
        <div>
          <p
            className="status-text"
            style={{ margin: 0, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Active scheduled tasks
          </p>
          <p
            style={{
              margin: "0.35rem 0 0",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--xf-gain-green)",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {activeScheduledCount}
            <span className="status-text" style={{ fontSize: "0.75rem", fontWeight: 500, marginLeft: "0.35rem" }}>
              / {tasks.length} total
            </span>
          </p>
        </div>
        <div>
          <p
            className="status-text"
            style={{ margin: 0, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Jobs running
          </p>
          <p
            style={{
              margin: "0.35rem 0 0",
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--xf-lightning-yellow)",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {runningJobsCount}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.35rem" }}>
          <p
            className="status-text"
            style={{ margin: 0, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Status
          </p>
          <span className={opsStatus.badgeClass}>{opsStatus.label}</span>
        </div>
      </div>

      <article className="surface-card xf-widget section-card">
        <div
          className="tool-row"
          role="tablist"
          aria-label="Scheduled tasks sections"
          style={{
            gap: "0.35rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            paddingBottom: "0.75rem"
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tasks"}
            className={`tiny-button ${activeTab === "tasks" ? "cta cta-primary" : ""}`}
            onClick={() => setActiveTab("tasks")}
            disabled={loading}
          >
            Tasks ({tasks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            className={`tiny-button ${activeTab === "schedule" ? "cta cta-primary" : ""}`}
            onClick={() => setActiveTab("schedule")}
            disabled={loading}
          >
            Schedule tasks
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "runs"}
            className={`tiny-button ${activeTab === "runs" ? "cta cta-primary" : ""}`}
            onClick={() => setActiveTab("runs")}
            disabled={loading}
          >
            Task runs ({runs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "channels"}
            className={`tiny-button ${activeTab === "channels" ? "cta cta-primary" : ""}`}
            onClick={() => setActiveTab("channels")}
            disabled={loading}
          >
            Delivery channels ({deliveryChannels.length})
          </button>
        </div>

        {activeTab === "tasks" ? (
          <div className="stack-gap">
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Edit <strong>tenant-level</strong> scheduled jobs (global admin only). Use <strong>Schedule tasks</strong>{" "}
              to create job schedules. Set a delivery channel on a row to post a run summary to{" "}
              <strong>Slack</strong> or <strong>email</strong> (SMTP) after every run (manual or scheduler).
            </p>
            {tasks.length > 0 ? (
              <div className="crud-table-wrap">
                <table className="crud-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Job Type</th>
                      <th>Delivery channel</th>
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
                            <select
                              className="crud-input text-xs"
                              disabled={loading}
                              value={m.deliveryChannelTarget ?? ""}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...prev[id],
                                    deliveryChannelTarget: e.target.value === "" ? null : e.target.value
                                  }
                                }))
                              }
                            >
                              <option value="">— None —</option>
                              {deliveryChannels.map((ch) => (
                                <option key={ch._id} value={ch._id}>
                                  {ch.name}
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
              <p className="status-text">No tasks yet. Open the Schedule tasks tab to create a job schedule.</p>
            )}
          </div>
        ) : activeTab === "schedule" ? (
          <div className="stack-gap">
            <h3>Predefined job templates</h3>
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Pick a template to prefill job type and default cron (
              <code className="font-mono text-xs">{SCHEDULED_TASK_CATEGORY_DEFAULT_CRON.price_scanner}</code> — weekdays
              08:00–17:59 UTC, every 15 minutes). Link a <strong>Slack</strong> delivery channel on each task to receive run
              summaries (status, duration, full job output — same keyed metrics style for core scanners, e.g.{" "}
              <code className="font-mono text-xs">price_scanner</code>,{" "}
              <code className="font-mono text-xs">watchlist_price_scanner</code>).
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
                  {CATEGORIES.map((jobType) => {
                    const meta = SCHEDULED_TASK_CATEGORY_CATALOG[jobType];
                    return (
                      <tr key={jobType}>
                        <td>
                          <code className="font-mono text-xs">{meta.defaultJobName}</code>
                        </td>
                        <td>
                          <code className="font-mono text-xs">{jobType}</code>
                        </td>
                        <td>{meta.description}</td>
                        <td>
                          <code className="font-mono text-xs">
                            {SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[jobType]}
                          </code>
                        </td>
                        <td>
                          <button
                            className="tiny-button"
                            disabled={loading}
                            onClick={() => {
                              setCreateJobType(jobType);
                              setCreateSchedule({
                                scheduleCron: SCHEDULED_TASK_CATEGORY_DEFAULT_CRON[jobType],
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3>Create job schedule</h3>
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
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {JOB_TYPE_LABELS[c]}
                  </option>
                ))}
              </select>
              <p className="status-text">
                Job name:{" "}
                <code className="font-mono text-xs">{defaultJobNameForCategory(createJobType)}</code>
                <span className="text-[var(--xf-text-300)]"> — {selectedCreateTemplate.description}</span>
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span>Delivery channel — Slack recommended (run summary after each execution)</span>
                <select
                  className="crud-input text-xs"
                  disabled={loading}
                  value={createDeliveryChannelTarget}
                  onChange={(e) => setCreateDeliveryChannelTarget(e.target.value)}
                >
                  <option value="">— None —</option>
                  {deliveryChannels.map((ch) => (
                    <option key={ch._id} value={ch._id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </label>
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
          </div>
        ) : activeTab === "runs" ? (
          <div className="stack-gap">
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Recent execution history for tenant-level scheduled tasks.
            </p>
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
        ) : (
          <div className="stack-gap">
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Tenant delivery targets for task output and notifications. Use the admin hub <strong>Delivery channels</strong>{" "}
              page to add, edit, or send test messages.
            </p>
            {deliveryChannels.length > 0 ? (
              <div className="crud-table-wrap">
                <table className="crud-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Target</th>
                      <th>Slack / email</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryChannels.map((ch) => (
                      <tr key={ch._id}>
                        <td>{ch.name}</td>
                        <td>
                          {ch.deliveryTarget === "slack"
                            ? "Slack"
                            : ch.deliveryTarget === "email"
                              ? "Email"
                              : "In-app"}
                        </td>
                        <td className="font-mono text-xs">
                          {ch.deliveryTarget === "slack"
                            ? formatSlackWebhookPreview(ch.slackWebhookUrl ?? "")
                            : ch.deliveryTarget === "email"
                              ? formatEmailPreview(ch.emailTo ?? "")
                              : "—"}
                        </td>
                        <td className="font-mono text-xs text-slate-400">
                          {new Date(ch.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="status-text">
                No delivery channels yet. Create one from the admin hub <strong>Delivery channels</strong> page.
              </p>
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
