"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { UserTaskJson } from "@/modules/user-tasks/serialize";

import { UserTaskReportMarkdown } from "@/app/account/tasks/user-task-report-markdown";

const REPORT_MARKDOWN_WRAP =
  "mt-2 max-h-72 overflow-y-auto rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,transparent)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--xf-text-300)] [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-[var(--xf-text-100)] [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-[var(--xf-text-200)] [&_h3]:mt-2 [&_h3]:text-xs [&_h3]:font-semibold [&_p]:mt-1 [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:text-[var(--xf-text-200)] [&_code]:rounded [&_code]:bg-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[var(--xf-text-300)] [&_pre]:my-2 [&_pre]:max-h-40 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-[color-mix(in_srgb,var(--xf-text-100)_6%,transparent)] [&_pre]:p-2 [&_pre]:font-mono [&_a]:text-[var(--xf-gain-green)] [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--xf-text-500)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--xf-text-400)]";

const HISTORY_MARKDOWN_WRAP =
  "mt-1 max-h-56 overflow-y-auto rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_92%,transparent)] px-2 py-1.5 text-[0.75rem] leading-relaxed text-[var(--xf-text-300)] [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-[var(--xf-text-100)] [&_h2]:mt-2 [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:mt-1 [&_h3]:text-[0.7rem] [&_p]:mt-1 [&_ul]:ml-3 [&_ul]:list-disc [&_li]:my-0.5 [&_strong]:text-[var(--xf-text-200)] [&_a]:text-[var(--xf-gain-green)]";

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
    prompt: `You are a seasoned financial advisor with a constructive, data-driven bias.

Task: Monitor the full portfolio and produce a **clean, professional daily Markdown report**.

**Rules:**
- Output ONLY the final report in Markdown. No preamble, no chain-of-thought, no internal tags, **no XF_CITE / citation chips**, no raw tool JSON fences, no meta lines like "Here is your report".
- Be detailed and actionable; avoid vague one-liners.
- Put **today's calendar date** in the H1 title (shape: "# Daily Portfolio Monitor — May 15, 2026").

**Use this exact section order:**

## Executive Summary
One paragraph: key P&L / risk headline, largest material move if any.

## Portfolio Snapshot
- Total equity / book value (latest tool data)
- Cash by account bucket when available (Individual TOD, Rollover IRA, Roth IRA, Joint, etc.)
- Top holdings with approximate notionals and % of book
- Call out concentration if any single name exceeds ~15% of book

## Changes Since Last Run
- Material adds/reduces, new/closed options, rolls
- Unusual single-name moves when data supports it

## Risk & Opportunity Highlights
- Concentrations, liquidity / margin flags if surfaced
- Concrete options-income ideas to review today (covered calls, cash-secured puts, collars) when they fit the book

## Action Items
Bullet checklist the user can execute today

**Health snapshot** (only if desk data supports it): margin utilization, unsettled cash, etc.

Use **atx_function** (portfolio_summary, positions_snapshot, watchlist_snapshot, account_health, market_quote) and **yahoo_finance** as needed, then translate results into prose with explicit numbers — not chip markup.`,
    defaultEmail: false
  },
  {
    id: "weekly_summary",
    title: "Weekly Portfolio Summary",
    description: "Monday digest with weekly recap, risk posture, and next-step checklist.",
    preset: "weekly",
    name: "Weekly Portfolio Summary",
    prompt: `You are a seasoned financial advisor with a constructive, data-driven bias.

Task: Produce a **clean, professional weekly Markdown portfolio digest**.

**Rules:**
- Output ONLY the final report in Markdown. No preamble, no internal tags, **no XF_CITE / citation chips**, no raw tool JSON fences.
- Be detailed; tie claims to numbers from this run's tools.
- Put **this week's calendar context** in the H1 (shape: "# Weekly Portfolio Summary — week of May 12, 2026").

**Use this exact section order:**

## Executive Summary
Week-over-week headline: performance vs prior week, one risk or opportunity callout.

## Portfolio Snapshot
- Ending equity / book value vs prior week when inferable
- Cash posture by major account buckets when available
- Top holdings with % of book and any concentration >15%

## Weekly Movers & Flows
- Largest % movers (longs/shorts/options) with brief context
- Notable flows: adds, trims, rolls, assignments if visible in data

## Risk Posture
- Greeks / beta / sector tilts at a high level when data exists; otherwise qualitative risk concentration

## Opportunities For Next Week
- Options-income or hedging ideas aligned to the book (CC, CSP, protective structures)

## Action Items
Checklist for the coming week

Use **atx_function** and **yahoo_finance** as needed; deliver polished Markdown only.`,
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
        data?: {
          snippet?: string;
          linkHint?: string;
          errorCode?: string;
          status?: "success" | "failed" | "skipped";
        };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Run failed");
      }
      const runStatus = json.data?.status;
      if (runStatus === "failed" || runStatus === "skipped") {
        const detail = [json.data?.snippet, json.data?.errorCode].filter(Boolean).join(" — ");
        throw new Error(detail.length > 0 ? detail : runStatus === "skipped" ? "Run skipped" : "Run failed");
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
            ? "Primary automation surface for power users. Schedule finance-advisor xChat jobs (fast routing), run now, and track in-app run notifications."
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
              className="crud-input text-sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Frequency</span>
            <select
              className="crud-input text-sm"
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
            className="crud-input min-h-[110px] text-sm"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        {isWorkspaceMode ? (
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Persona override (optional)</span>
            <input
              className="crud-input font-mono text-sm"
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
              Start with Daily Portfolio Monitor or Weekly Portfolio Summary. Jobs run in xChat using the
              **finance-advisor** persona and **fast** depth by default.
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
                    <div className="mt-2 border-t border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] pt-2">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--xf-text-500)]">
                        Last run
                      </p>
                      <UserTaskReportMarkdown text={t.lastResultSnippet} className={REPORT_MARKDOWN_WRAP} />
                    </div>
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
                  {row.outputSnippet?.trim() ? (
                    <UserTaskReportMarkdown text={row.outputSnippet} className={HISTORY_MARKDOWN_WRAP} />
                  ) : (
                    <p className="mt-1 text-xs text-[var(--xf-text-200)]">No output.</p>
                  )}
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
