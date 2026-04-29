"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { UserTaskJson } from "@/modules/user-tasks/serialize";

type Props = {
  initialPortfolioId?: string | null;
};

export function UserTasksClient({ initialPortfolioId }: Props) {
  const [rows, setRows] = useState<UserTaskJson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = initialPortfolioId?.trim();
    return p && /^[a-f\d]{24}$/i.test(p) ? `?portfolioId=${encodeURIComponent(p)}` : "";
  }, [initialPortfolioId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks${query}`);
      const json = (await res.json().catch(() => ({}))) as { data?: UserTaskJson[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load tasks");
      }
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setRows([]);
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

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[color-mix(in_srgb,var(--xf-bg-900)_88%,transparent)] p-6 shadow-sm backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--xf-gain-green)]">Automation</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--xf-text-100)]">Tasks</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--xf-text-300)]">
          Schedule recurring xChat prompts tied to your workspace (portfolio / watchlist). Run now to test; automation uses
          the same billing and rate limits as xChat. Strategy scanner handoff remains roadmap for non–prompt types.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--xf-gain-green)_45%,transparent)] bg-[color-mix(in_srgb,var(--xf-gain-green)_12%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--xf-gain-green)] transition hover:bg-[color-mix(in_srgb,var(--xf-gain-green)_18%,transparent)]"
            href="/xchat"
          >
            Open xChat
          </Link>
          <span className="self-center text-xs text-[var(--xf-text-400)]">
            Create/edit API: use Admin docs or extend UI in a follow-up.
          </span>
        </div>
      </header>

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
              Examples: daily watchlist income scan, weekly rebalance suggestion, IV-change alerts (prompt the model with
              your rules). Create tasks via{" "}
              <code className="rounded bg-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)] px-1.5 py-0.5 font-mono text-xs">
                POST /api/tasks
              </code>{" "}
              until the composer UI ships.
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
                  <button
                    className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_40%,transparent)] px-3 py-1.5 text-sm font-semibold text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] transition hover:bg-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_12%,transparent)] disabled:opacity-50"
                    disabled={runningId === t.id}
                    type="button"
                    onClick={() => void runNow(t.id)}
                  >
                    {runningId === t.id ? "Running…" : "Run now"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--xf-text-500)]">
        <span className="xf-disclaimer-emphasis">Not financial advice.</span> Scheduled execution is invoked by your
        operator via{" "}
        <code className="font-mono">POST /api/internal/user-tasks/process-due</code> (scheduler secret). Same xChat usage
        limits apply.
      </p>
    </div>
  );
}
