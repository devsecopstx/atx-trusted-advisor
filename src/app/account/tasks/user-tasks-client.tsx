"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { UserTaskJson } from "@/modules/user-tasks/serialize";

type Props = {
  initialPortfolioId?: string | null;
  mode?: "account" | "workspace";
};

type UserTaskMeta = {
  totalCount: number;
  userTasksMax: number;
};

type UserTaskRunJson = {
  id: string;
  taskId: string;
  status: "running" | "success" | "failed" | "skipped";
  triggeredBy: string;
  outputSnippet?: string;
  errorCode?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  linkHint?: string;
};

type UserTaskTemplate = {
  id: "daily_monitor" | "weekly_summary";
  title: string;
  description: string;
  preset: "daily" | "weekly";
  name: string;
  prompt: string;
  defaultEmail: boolean;
};

const USER_TASK_TEMPLATES: UserTaskTemplate[] = [
  {
    id: "daily_monitor",
    title: "Daily Portfolio Monitor",
    description: "Weekday portfolio pulse with material risk and position-change flags.",
    preset: "daily",
    name: "Daily Portfolio Monitor",
    prompt:
      "Monitor my portfolio and summarize material risk or position changes since the last run. Highlight concentrations, unusual moves, and any options income opportunities to review today.",
    defaultEmail: false
  },
  {
    id: "weekly_summary",
    title: "Weekly Portfolio Summary",
    description: "Monday digest with weekly recap, risk posture, and next-step checklist.",
    preset: "weekly",
    name: "Weekly Portfolio Summary",
    prompt:
      "Create a weekly portfolio summary with top movers, realized vs unrealized changes, risk posture, and a concise action checklist for next week.",
    defaultEmail: true
  }
];

export function UserTasksClient({ initialPortfolioId, mode = "account" }: Props) {
  const isWorkspaceMode = mode === "workspace";
  const [rows, setRows] = useState<UserTaskJson[]>([]);
  const [meta, setMeta] = useState<UserTaskMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<UserTaskRunJson[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [templateId, setTemplateId] = useState<UserTaskTemplate["id"]>("daily_monitor");
  const [name, setName] = useState(USER_TASK_TEMPLATES[0].name);
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState(USER_TASK_TEMPLATES[0].prompt);
  const [preset, setPreset] = useState<"daily" | "weekly" | "monthly">(USER_TASK_TEMPLATES[0].preset);
  const [sendEmail, setSendEmail] = useState(USER_TASK_TEMPLATES[0].defaultEmail);
  const [personaOverride, setPersonaOverride] = useState("");
  const [creating, setCreating] = useState(false);

  const query = useMemo(() => {
    const p = initialPortfolioId?.trim();
    return p && /^[a-f\d]{24}$/i.test(p) ? `?portfolioId=${encodeURIComponent(p)}` : "";
  }, [initialPortfolioId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks${query}`);
      const json = (await res.json().catch(() => ({}))) as {
        data?: UserTaskJson[];
        meta?: UserTaskMeta;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load tasks");
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
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runNow(id: string) {
    setRunningId(id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { snippet?: string; linkHint?: string; errorCode?: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Run failed");
      }
      const hint = json.data?.linkHint?.trim();
      setNotice(
        hint
          ? `Done — ${json.data?.snippet?.slice(0, 160) ?? "see xChat"}. Open: ${hint}`
          : (json.data?.snippet ?? "Completed.")
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunningId(null);
    }
  }

  async function createTask() {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const delivery = sendEmail ? ["in_app", "email"] : ["in_app"];
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        type: "prompt",
        prompt: prompt.trim(),
        schedule: { preset },
        delivery
      };
      const personaId = personaOverride.trim();
      if (personaId) {
        payload.personaId = personaId;
      }
      if (initialPortfolioId && /^[a-f\d]{24}$/i.test(initialPortfolioId)) {
        payload.portfolioId = initialPortfolioId;
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not create task");
      }
      setNotice("Task created.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(task: UserTaskJson, enabled: boolean) {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Update failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function deleteTask(taskId: string) {
    if (!globalThis.confirm?.("Delete this task?")) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Delete failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function loadHistory(taskId: string) {
    setHistoryTaskId(taskId);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/runs?limit=20`);
      const json = (await res.json().catch(() => ({}))) as { data?: UserTaskRunJson[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load run history");
      }
      setHistoryRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "History load failed");
    } finally {
      setHistoryLoading(false);
    }
  }

  function applyTemplate(nextTemplateId: UserTaskTemplate["id"]) {
    setTemplateId(nextTemplateId);
    const template = USER_TASK_TEMPLATES.find((t) => t.id === nextTemplateId) ?? USER_TASK_TEMPLATES[0];
    setName(template.name);
    setPrompt(template.prompt);
    setPreset(template.preset);
    setSendEmail(template.defaultEmail);
  }

  const totalCount = meta?.totalCount ?? rows.length;
  const userTasksMax = meta?.userTasksMax ?? 5;
  const remaining = Math.max(0, userTasksMax - totalCount);
  const canCreate = totalCount < userTasksMax;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,transparent)] p-6 shadow-sm backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--xf-gain-green)]">Automation</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--xf-text-100)]">Tasks</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--xf-text-300)]">
          {isWorkspaceMode
            ? "Primary automation surface for power users. Schedule advisor-powered xChat jobs, run now, and track in-app run notifications."
            : "Your task feed with template-driven create. Use Daily Monitor or Weekly Summary and review run notifications in app."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[color-mix(in_srgb,var(--xf-gain-green)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--xf-text-100)]">
            {remaining} jobs remaining
          </span>
          <span className="text-xs text-[var(--xf-text-400)]">
            Current: {totalCount}/{userTasksMax} active saved jobs
          </span>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,transparent)] p-5">
        <h2 className="text-base font-semibold text-[var(--xf-text-100)]">Create job</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {USER_TASK_TEMPLATES.map((template) => (
            <button
              key={template.id}
              className={`rounded-xl border p-4 text-left transition ${
                templateId === template.id
                  ? "border-[color-mix(in_srgb,var(--xf-gain-green)_55%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_9%,transparent)]"
                  : "border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_95%,transparent)] hover:border-[color-mix(in_srgb,var(--xf-text-100)_28%,transparent)]"
              }`}
              type="button"
              onClick={() => applyTemplate(template.id)}
            >
              <p className="text-sm font-semibold text-[var(--xf-text-100)]">{template.title}</p>
              <p className="mt-1 text-xs text-[var(--xf-text-400)]">{template.description}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Name</span>
            <input
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-bg-950,_#020617)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Frequency</span>
            <select
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-bg-950,_#020617)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
              value={preset}
              onChange={(event) => setPreset(event.target.value as "daily" | "weekly" | "monthly")}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Instructions</span>
          <textarea
            className="min-h-[110px] w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-bg-950,_#020617)] px-3 py-2 text-sm text-[var(--xf-text-100)]"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        {isWorkspaceMode ? (
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Persona override (optional)</span>
            <input
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_14%,transparent)] bg-[var(--xf-bg-950,_#020617)] px-3 py-2 font-mono text-sm text-[var(--xf-text-100)]"
              placeholder="persona ObjectId (optional)"
              value={personaOverride}
              onChange={(event) => setPersonaOverride(event.target.value)}
            />
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--xf-text-300)]">
            <input checked={sendEmail} type="checkbox" onChange={(event) => setSendEmail(event.target.checked)} />
            Email digest copy
          </label>
          <button
            className="rounded-lg bg-[var(--xf-gain-green)] px-4 py-2 text-sm font-semibold text-[var(--xf-bg-950,_#020617)] disabled:opacity-45"
            disabled={creating || !canCreate || name.trim().length === 0 || prompt.trim().length < 4}
            type="button"
            onClick={() => void createTask()}
          >
            {creating ? "Creating..." : "Create job"}
          </button>
        </div>
      </section>

      {notice ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_8%,transparent)] px-4 py-3 text-sm text-[var(--xf-text-200)]">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--xf-chart-loss)_40%,transparent)] bg-[color-mix(in_srgb,var(--xf-chart-loss)_10%,transparent)] px-4 py-3 text-sm text-[var(--xf-text-200)]">
          {error}
        </div>
      ) : null}

      <section aria-label="Saved tasks">
        {loading ? (
          <p className="text-sm text-[var(--xf-text-400)]">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] p-8 text-sm text-[var(--xf-text-300)]">
            <p className="font-medium text-[var(--xf-text-200)]">No tasks yet</p>
            <p className="mt-2">
              Start with Daily Portfolio Monitor or Weekly Portfolio Summary. Jobs run against xChat with advisor as
              default persona.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,transparent)] p-4 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-[var(--xf-text-100)]">{t.name}</h2>
                    <span className="rounded-md bg-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] px-2 py-0.5 text-[0.65rem] font-mono uppercase text-[var(--xf-text-300)]">
                      {t.type}
                    </span>
                    {!t.enabled ? (
                      <span className="text-[0.65rem] font-semibold uppercase text-[var(--xf-text-400)]">Paused</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-[var(--xf-text-400)]">{t.prompt}</p>
                  <dl className="mt-2 grid gap-1 text-xs text-[var(--xf-text-400)] sm:grid-cols-2">
                    <div>
                      <dt className="inline text-[var(--xf-text-500)]">Schedule: </dt>
                      <dd className="inline text-[var(--xf-text-300)]">{t.scheduleDescription ?? t.scheduleCron ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-[var(--xf-text-500)]">Next run: </dt>
                      <dd className="inline text-[var(--xf-text-300)]">
                        {t.nextRunAt ? new Date(t.nextRunAt).toLocaleString() : "—"}
                      </dd>
                    </div>
                  </dl>
                  {t.lastResultSnippet ? (
                    <p className="mt-2 border-t border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] pt-2 text-xs text-[var(--xf-text-400)]">
                      Last: {t.lastResultSnippet.slice(0, 220)}
                      {t.lastResultSnippet.length > 220 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2 md:items-end">
                  {isWorkspaceMode ? (
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--xf-text-400)]">
                      <input
                        checked={t.enabled}
                        type="checkbox"
                        onChange={(event) => void toggleEnabled(t, event.target.checked)}
                      />
                      Enabled
                    </label>
                  ) : null}
                  <button
                    className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_40%,transparent)] px-3 py-1.5 text-sm font-semibold text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] transition hover:bg-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_12%,transparent)] disabled:opacity-50"
                    disabled={runningId === t.id}
                    type="button"
                    onClick={() => void runNow(t.id)}
                  >
                    {runningId === t.id ? "Running…" : "Run now"}
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_22%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--xf-text-300)] transition hover:bg-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)]"
                    type="button"
                    onClick={() => void loadHistory(t.id)}
                  >
                    History
                  </button>
                  {isWorkspaceMode ? (
                    <button
                      className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--xf-chart-loss)_40%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--xf-text-300)] transition hover:bg-[color-mix(in_srgb,var(--xf-chart-loss)_12%,transparent)]"
                      type="button"
                      onClick={() => void deleteTask(t.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {historyTaskId ? (
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,transparent)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--xf-text-100)]">In-app notifications (run history)</h3>
            <button
              className="text-xs text-[var(--xf-text-400)]"
              type="button"
              onClick={() => {
                setHistoryTaskId(null);
                setHistoryRows([]);
              }}
            >
              Close
            </button>
          </div>
          {historyLoading ? (
            <p className="text-sm text-[var(--xf-text-400)]">Loading...</p>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-[var(--xf-text-400)]">No runs yet.</p>
          ) : (
            <ul className="space-y-2">
              {historyRows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_95%,transparent)] px-3 py-2"
                >
                  <p className="text-xs text-[var(--xf-text-400)]">
                    {new Date(row.startedAt).toLocaleString()} · {row.status} · {row.triggeredBy}
                  </p>
                  <p className="mt-1 text-xs text-[var(--xf-text-200)]">{row.outputSnippet ?? "No output."}</p>
                  {row.linkHint ? (
                    <p className="mt-1 text-xs text-[var(--xf-gain-green)]">xChat link: {row.linkHint}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className="text-xs text-[var(--xf-text-500)]">
        <span className="xf-disclaimer-emphasis">Not financial advice.</span> Scheduled execution is invoked by your
        operator via{" "}
        <code className="font-mono">POST /api/internal/user-tasks/process-due</code> (scheduler secret). Same xChat usage
        limits apply.
      </p>
    </div>
  );
}
