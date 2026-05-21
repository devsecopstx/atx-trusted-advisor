"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    AdminTaskRunDetailDialog,
    taskRunOutputSnippet,
    type AdminTaskRunDetail
} from "@/app/admin/tasks/ui/admin-task-run-detail-dialog";
import { RRuleScheduleBuilderModal } from "@/app/admin/tasks/ui/rrule-schedule-builder-modal";
import { AddIcon, DeleteIcon, RefreshIcon, RunIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import {
    ADMIN_TASKS_DISPLAY_TIME_ZONE_OPTIONS,
    DEFAULT_ADMIN_TASKS_DISPLAY_TIME_ZONE,
    formatDateTimeInTimeZone,
    loadStoredAdminTasksDisplayTimeZone,
    persistAdminTasksDisplayTimeZone
} from "@/lib/admin-tasks-display-timezone";
import { SCHEDULED_TASK_CATEGORY_CATALOG } from "@/lib/scheduled-task-category-catalog";
import {
    isKnownScheduledTaskCategory,
    scheduledTaskCategoryDisplayName
} from "@/lib/scheduled-task-category-display";
import {
    SCHEDULED_TASK_CATEGORIES,
    SCHEDULED_TASK_CATEGORY_DEFAULT_CRON
} from "@/lib/scheduled-task-category-schema";
import type { ScheduledTask as ScheduledTaskDoc } from "@/modules/core-admin/types";

type ScheduledTask = {
  _id?: string;
  name: string;
  /** Executor slug from Mongo — may be invalid if row was misconfigured. */
  category: string;
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

type TaskRunExecutorRow = {
  runtime: string;
  environment: string;
  label: string;
  service?: string;
  revision?: string;
  host?: string;
  delegateFrom?: string;
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
  executor?: TaskRunExecutorRow;
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
  const [activeTab, setActiveTab] = useState<"jobs" | "schedule" | "runs">("jobs");
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  /** Default: current UTC calendar day; optional rolling 30 days. */
  const [runHistoryWindow, setRunHistoryWindow] = useState<"today" | "30d">("today");
  /** Run history tab — filter/sort apply to rows already loaded for the window. */
  const [runCategoryFilter, setRunCategoryFilter] = useState<"" | ScheduledTaskDoc["category"]>("");
  const [runSortField, setRunSortField] = useState<"startedAt" | "status">("startedAt");
  const [runSortDir, setRunSortDir] = useState<"asc" | "desc">("desc");
  const [runFailedOnly, setRunFailedOnly] = useState(false);
  const [selectedRun, setSelectedRun] = useState<AdminTaskRunDetail | null>(null);
  const [deliveryChannels, setDeliveryChannels] = useState<DeliveryChannelRow[]>([]);
  /** Timestamps (next run, run history, channel updated); cron matching stays UTC — see copy in Tasks tab. */
  const [displayTimeZone, setDisplayTimeZone] = useState(DEFAULT_ADMIN_TASKS_DISPLAY_TIME_ZONE);
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
  const skipRunWindowEffectOnce = useRef(true);
  const selectedCreateTemplate = useMemo(
    () => SCHEDULED_TASK_CATEGORY_CATALOG[createJobType],
    [createJobType]
  );

  const filteredSortedRuns = useMemo(() => {
    let list =
      runCategoryFilter === ""
        ? [...runs]
        : runs.filter((r) => r.category === runCategoryFilter);
    if (runFailedOnly) {
      list = list.filter((r) => r.status === "failed");
    }
    const statusRank: Record<TaskRun["status"], number> = { failed: 3, running: 2, success: 1 };
    list.sort((a, b) => {
      if (runSortField === "startedAt") {
        const ta = new Date(a.startedAt).getTime();
        const tb = new Date(b.startedAt).getTime();
        const primary = runSortDir === "desc" ? tb - ta : ta - tb;
        if (primary !== 0) {
          return primary;
        }
        const sa = statusRank[a.status] ?? 0;
        const sb = statusRank[b.status] ?? 0;
        return sb - sa;
      }
      const ra = statusRank[a.status] ?? 0;
      const rb = statusRank[b.status] ?? 0;
      const primary = runSortDir === "desc" ? rb - ra : ra - rb;
      if (primary !== 0) {
        return primary;
      }
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
    return list;
  }, [runs, runCategoryFilter, runFailedOnly, runSortField, runSortDir]);

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
      const params = new URLSearchParams({ window: runHistoryWindow });
      const payload = await parseJson<{ data: TaskRun[] }>(
        await fetch(`/api/admin/task-runs?${params.toString()}`)
      );
      setRuns(payload.data);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to refresh runs");
    }
  }, [runHistoryWindow]);

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
      setActiveTab("jobs");
      setStatus("Created — see Jobs tab");
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
      const row = tasks.find((t) => t._id === taskId);
      const payload = await parseJson<{
        data: { runId: string; status: TaskRun["status"]; output: string };
      }>(await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}/run`, { method: "POST" }));
      setStatus(`Job finished: ${payload.data.status}`);
      await refreshAll();
      setActiveTab("runs");
      setSelectedRun({
        _id: payload.data.runId,
        taskId,
        taskName: row?.name ?? taskId,
        category: row?.category ?? "compliance",
        triggeredBy: "manual",
        status: payload.data.status,
        startedAt: new Date().toISOString(),
        output: payload.data.output ?? ""
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to run job");
    } finally {
      setRunningTaskId(null);
    }
  }

  useEffect(() => {
    const stored = loadStoredAdminTasksDisplayTimeZone();
    if (stored) {
      setDisplayTimeZone(stored);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
    pollRef.current = setInterval(() => {
      void refreshAll();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (skipRunWindowEffectOnce.current) {
      skipRunWindowEffectOnce.current = false;
      return;
    }
    void refreshRuns();
  }, [runHistoryWindow, refreshRuns]);

  return (
    <section className="panel stack-gap">
      <div className="tool-row" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: "0.75rem" }}>
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
        <label className="flex flex-col gap-1 text-sm" style={{ minWidth: "14rem" }}>
          <span className="status-text text-xs uppercase tracking-wide">Display timezone</span>
          <select
            aria-label="Timezone for schedule and run timestamps"
            className="crud-input text-sm"
            disabled={loading}
            value={displayTimeZone}
            onChange={(e) => {
              const next = e.target.value;
              setDisplayTimeZone(next);
              persistAdminTasksDisplayTimeZone(next);
            }}
          >
            {ADMIN_TASKS_DISPLAY_TIME_ZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <p className="status-text" style={{ margin: 0, flex: "1 1 12rem" }}>
          {status}
        </p>
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
          aria-label="Scheduled jobs sections"
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
            aria-selected={activeTab === "jobs"}
            className={`tiny-button ${activeTab === "jobs" ? "cta cta-primary" : ""}`}
            onClick={() => setActiveTab("jobs")}
            disabled={loading}
          >
            Jobs ({tasks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            className={`tiny-button ${activeTab === "schedule" ? "cta cta-primary" : ""}`}
            onClick={() => setActiveTab("schedule")}
            disabled={loading}
          >
            Add job
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "runs"}
            className={`tiny-button ${activeTab === "runs" ? "cta cta-primary" : ""}`}
            onClick={() => setActiveTab("runs")}
            disabled={loading}
          >
            Task runs ({runs.length}
            {runHistoryWindow === "today" ? " · today (UTC window)" : " · 30d"})
          </button>
          <Link className="tiny-button cta cta-secondary" href="/admin/delivery-channels">
            Delivery channels
          </Link>
        </div>

        {activeTab === "jobs" ? (
          <div className="stack-gap">
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Edit <strong>system-wide</strong> scheduled jobs (global admin only): each row runs once per tenant in{" "}
              <code className="font-mono text-xs">core_tenants</code>, and run summaries (Slack/email) include{" "}
              <strong>combined output across tenants</strong>. Use <strong>Add job</strong> to create schedules.
              Set a delivery channel to post after every run (manual or scheduler). Manage channels on{" "}
              <Link className="underline font-medium" href="/admin/delivery-channels">
                Delivery channels
              </Link>
              ; the job itself is not stored with a single{" "}
              <code className="font-mono text-xs">tenantId</code>.{" "}
              <strong>Cron expressions use UTC</strong> (engine matches UTC clock); <strong>Next run</strong> and run
              history timestamps use the <strong>display timezone</strong> you pick above (default Central).
            </p>
            {tasks.length > 0 ? (
              <div className="crud-table-wrap">
                <table className="crud-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Job type</th>
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
                              title={id ? `Job id: ${id}` : undefined}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [id]: { ...prev[id], name: e.target.value }
                                }))
                              }
                            />
                          </td>
                          <td className="admin-tasks-category-cell">
                            <code className="font-mono text-xs admin-tasks-category-slug" title="Executor slug">
                              {m.category}
                            </code>
                            {!isKnownScheduledTaskCategory(m.category) ? (
                              <p className="status-text status-warn admin-tasks-category-hint">
                                Invalid category — pick a job type and Save.
                              </p>
                            ) : (
                              <p className="status-text admin-tasks-category-hint">
                                {scheduledTaskCategoryDisplayName(m.category)}
                              </p>
                            )}
                            {id ? (
                              <p className="status-text admin-tasks-category-hint">
                                Job id: <code className="font-mono text-xs">{id}</code>
                              </p>
                            ) : null}
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
                                    category: e.target.value
                                  }
                                }))
                              }
                            >
                              {!isKnownScheduledTaskCategory(m.category) ? (
                                <option value={m.category}>{m.category} (invalid — fix me)</option>
                              ) : null}
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
                          <td>
                            {row.nextRunAt
                              ? formatDateTimeInTimeZone(row.nextRunAt, displayTimeZone)
                              : "—"}
                          </td>
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
              <p className="status-text">No jobs yet. Open the Add job tab to create a schedule.</p>
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
                Category slug:{" "}
                <code className="font-mono text-xs">{createJobType}</code>
                {" · "}
                {scheduledTaskCategoryDisplayName(createJobType)}
              </p>
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
            <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.65rem" }}>
              <label className="flex flex-col gap-1 text-sm" style={{ minWidth: "12rem" }}>
                <span className="status-text text-xs uppercase tracking-wide">Run history</span>
                <select
                  aria-label="Task run history time range"
                  className="crud-input text-sm"
                  disabled={loading}
                  value={runHistoryWindow}
                  onChange={(e) => setRunHistoryWindow(e.target.value === "30d" ? "30d" : "today")}
                >
                  <option value="today">Today (UTC calendar day)</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm" style={{ minWidth: "14rem" }}>
                <span className="status-text text-xs uppercase tracking-wide">Job type</span>
                <select
                  aria-label="Filter task runs by job type"
                  className="crud-input text-sm"
                  disabled={loading}
                  value={runCategoryFilter}
                  onChange={(e) =>
                    setRunCategoryFilter(
                      e.target.value === "" ? "" : (e.target.value as ScheduledTaskDoc["category"])
                    )
                  }
                >
                  <option value="">All types</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {JOB_TYPE_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="flex items-end gap-2 text-sm checkbox-label"
                htmlFor="admin-task-runs-failed-only"
                style={{ minHeight: "2.75rem" }}
              >
                <input
                  checked={runFailedOnly}
                  disabled={loading}
                  id="admin-task-runs-failed-only"
                  type="checkbox"
                  onChange={(e) => setRunFailedOnly(e.target.checked)}
                />
                <span className="status-text">Failed only</span>
              </label>
              <label className="flex flex-col gap-1 text-sm" style={{ minWidth: "11rem" }}>
                <span className="status-text text-xs uppercase tracking-wide">Sort by</span>
                <select
                  aria-label="Sort task runs"
                  className="crud-input text-sm"
                  disabled={loading}
                  value={`${runSortField}:${runSortDir}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "startedAt:desc" || v === "startedAt:asc") {
                      setRunSortField("startedAt");
                      setRunSortDir(v.endsWith("desc") ? "desc" : "asc");
                    } else if (v === "status:desc" || v === "status:asc") {
                      setRunSortField("status");
                      setRunSortDir(v.endsWith("desc") ? "desc" : "asc");
                    }
                  }}
                >
                  <option value="startedAt:desc">Started — newest first</option>
                  <option value="startedAt:asc">Started — oldest first</option>
                  <option value="status:desc">Status — failed first</option>
                  <option value="status:asc">Status — success first</option>
                </select>
              </label>
              <p className="status-text" style={{ margin: 0, flex: "1 1 12rem", alignSelf: "flex-end" }}>
                Default shows runs that <strong>started</strong> on the current UTC calendar day (API window). The{" "}
                <strong>Started</strong> column uses your display timezone. Widen to 30 days for troubleshooting;
                polling and refresh use the same window. Filter and sort apply to the loaded rows only.
              </p>
            </div>
            <p className="status-text" style={{ marginBottom: "0.65rem" }}>
              Execution history for tenant-level scheduled tasks.
            </p>
            {runs.length === 0 ? (
              <p className="status-text">No task runs yet.</p>
            ) : filteredSortedRuns.length === 0 ? (
              <p className="status-text">
                {runFailedOnly
                  ? "No failed runs in this window. Clear Failed only or widen the time range."
                  : "No runs match the selected job type. Choose &quot;All types&quot; or widen the time window."}
              </p>
            ) : (
              <div className="crud-table-wrap">
                <table className="crud-table admin-task-runs-table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Category</th>
                      <th>Job type</th>
                      <th>Status</th>
                      <th>Triggered By</th>
                      <th>Started</th>
                      <th>Duration</th>
                      <th>Output preview</th>
                      <th aria-label="Actions"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedRuns.map((run) => {
                      const jobLabel = scheduledTaskCategoryDisplayName(run.category);
                      const categoryInvalid = !isKnownScheduledTaskCategory(run.category);
                      return (
                        <tr
                          key={run._id ?? run.startedAt}
                          className={run.status === "failed" ? "admin-task-runs-table__row--failed" : undefined}
                        >
                          <td>
                            <span title={`Job id: ${run.taskId}`}>{run.taskName}</span>
                          </td>
                          <td>
                            <code
                              className={`font-mono text-xs${categoryInvalid ? " admin-tasks-category-slug--invalid" : ""}`}
                              title={categoryInvalid ? "Unknown executor category" : undefined}
                            >
                              {run.category}
                            </code>
                          </td>
                          <td>
                            {jobLabel ?? (
                              <span className="status-text status-warn">Unknown type</span>
                            )}
                          </td>
                          <td className="admin-tasks-executed-on-cell">
                            {run.executor?.label ? (
                              <span
                                title={[
                                  run.executor.runtime,
                                  run.executor.environment,
                                  run.executor.service,
                                  run.executor.revision,
                                  run.executor.host
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              >
                                {run.executor.label}
                              </span>
                            ) : (
                              <span className="status-text">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-badge status-${run.status === "success" ? "ready" : run.status === "failed" ? "error" : "pending"}`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td>{run.triggeredBy}</td>
                          <td>{formatDateTimeInTimeZone(run.startedAt, displayTimeZone)}</td>
                          <td>{run.durationMs != null ? `${run.durationMs}ms` : "—"}</td>
                          <td className="output-cell">
                            <button
                              className="admin-task-runs-table__output-btn"
                              title={run.output?.trim() ? "View full log output" : "No output stored"}
                              type="button"
                              onClick={() => setSelectedRun(run)}
                            >
                              {taskRunOutputSnippet(run.output)}
                            </button>
                          </td>
                          <td>
                            <button
                              className={`tiny-button${run.status === "failed" ? " cta cta-secondary" : ""}`}
                              type="button"
                              onClick={() => setSelectedRun(run)}
                            >
                              View log
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </article>
      <AdminTaskRunDetailDialog
        displayTimeZone={displayTimeZone}
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
      />
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
