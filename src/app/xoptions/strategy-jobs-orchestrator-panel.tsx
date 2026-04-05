"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";

export type StrategyJobRow = {
  jobId: string;
  correlationId?: string | null;
  status: string;
  createdAt?: number;
  updatedAt?: number;
  artifactStatus?: string | null;
  currentSlotKey?: string | null;
  nextPrompt?: string | null;
  nextChoices?: string[] | null;
  slots: Record<string, string>;
  turns: unknown[];
};

type ArtifactPayload = {
  artifactStatus: string;
  jobId: string;
  correlationId?: string | null;
  artifactMarkdown?: string | null;
  artifactJson?: Record<string, unknown> | null;
  artifactModel?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function toFriendlyStrategyJobsMessage(rawMessage: string, fallback: string): string {
  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes("atxfinance_backend_origin") ||
    normalized.includes("spring bff") ||
    normalized.includes("strategy orchestrator requires")
  ) {
    return "Strategy jobs are not available right now. Please try again shortly.";
  }
  if (normalized.includes("503") || normalized.includes("unavailable")) {
    return "Strategy jobs are temporarily unavailable. Please try again shortly.";
  }
  return rawMessage || fallback;
}

export function StrategyJobsOrchestratorPanel(props: {
  autoStartNewJob?: boolean;
  onAutoStartConsumed?: () => void;
}) {
  const { autoStartNewJob, onAutoStartConsumed } = props;
  const [expanded, setExpanded] = useState(Boolean(autoStartNewJob));
  const [listErr, setListErr] = useState<string | null>(null);
  const [jobs, setJobs] = useState<StrategyJobRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [job, setJob] = useState<StrategyJobRow | null>(null);
  const [jobErr, setJobErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [artifact, setArtifact] = useState<ArtifactPayload | null>(null);
  const [artifactErr, setArtifactErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStarted = useRef(false);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadList = useCallback(async () => {
    setListErr(null);
    const res = await fetch("/api/strategy-jobs?limit=25", { credentials: "include" });
    const body = await parseJson<{ data?: { jobs?: StrategyJobRow[] }; error?: string; message?: string }>(res);
    if (!res.ok) {
      const rawMessage = body?.message ?? body?.error ?? `List failed (${res.status})`;
      setListErr(toFriendlyStrategyJobsMessage(rawMessage, `List failed (${res.status})`));
      setJobs([]);
      return;
    }
    const rows = body?.data?.jobs ?? [];
    setJobs(rows);
  }, []);

  const loadJob = useCallback(async (jobId: string) => {
    setJobErr(null);
    const res = await fetch(`/api/strategy-jobs/${jobId}`, { credentials: "include" });
    const body = await parseJson<{ data?: StrategyJobRow; error?: string }>(res);
    if (!res.ok || !body?.data) {
      const rawMessage = body?.error ?? `Load failed (${res.status})`;
      setJobErr(toFriendlyStrategyJobsMessage(rawMessage, `Load failed (${res.status})`));
      setJob(null);
      return;
    }
    setJob(body.data);
  }, []);

  const loadArtifactOnce = useCallback(async (jobId: string) => {
    setArtifactErr(null);
    const res = await fetch(`/api/strategy-jobs/${jobId}/artifact`, { credentials: "include" });
    const body = await parseJson<{ data?: ArtifactPayload; error?: string; message?: string; status?: string }>(res);
    if (res.status === 400 && body?.error === "artifact_not_ready") {
      setArtifact(null);
      setArtifactErr(body.message ?? "Complete slots first.");
      return;
    }
    if (!res.ok || !body?.data) {
      setArtifact(null);
      const rawMessage = body?.message ?? body?.error ?? `Artifact ${res.status}`;
      setArtifactErr(toFriendlyStrategyJobsMessage(rawMessage, `Artifact ${res.status}`));
      return;
    }
    setArtifact(body.data);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!autoStartNewJob || autoStarted.current) {
      return;
    }
    setExpanded(true);
    autoStarted.current = true;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/strategy-jobs", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        const body = await parseJson<{ data?: StrategyJobRow; error?: string; message?: string }>(res);
        if (!res.ok || !body?.data?.jobId) {
          const rawMessage = body?.message ?? body?.error ?? `Create failed (${res.status})`;
          setListErr(toFriendlyStrategyJobsMessage(rawMessage, `Create failed (${res.status})`));
          return;
        }
        setSelectedId(body.data.jobId);
        setJob(body.data);
        await loadList();
        onAutoStartConsumed?.();
      } finally {
        setBusy(false);
      }
    })();
  }, [autoStartNewJob, loadList, onAutoStartConsumed]);

  useEffect(() => {
    if (!selectedId) {
      setJob(null);
      setArtifact(null);
      stopPoll();
      return;
    }
    void loadJob(selectedId);
    void loadArtifactOnce(selectedId);
  }, [loadArtifactOnce, loadJob, selectedId, stopPoll]);

  useEffect(() => {
    stopPoll();
    if (!selectedId || job?.status !== "slots_complete") {
      return;
    }
    let ticks = 0;
    const tick = () => {
      ticks += 1;
      void loadArtifactOnce(selectedId);
      if (ticks > 48) {
        stopPoll();
      }
    };
    void loadArtifactOnce(selectedId);
    pollRef.current = setInterval(tick, 2500);
    return () => {
      stopPoll();
    };
  }, [job?.status, loadArtifactOnce, selectedId, stopPoll]);

  const createJob = async () => {
    setBusy(true);
    setListErr(null);
    try {
      const res = await fetch("/api/strategy-jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const body = await parseJson<{ data?: StrategyJobRow; error?: string; message?: string }>(res);
      if (!res.ok || !body?.data?.jobId) {
        const rawMessage = body?.message ?? body?.error ?? `Create failed (${res.status})`;
        setListErr(toFriendlyStrategyJobsMessage(rawMessage, `Create failed (${res.status})`));
        return;
      }
      setSelectedId(body.data.jobId);
      setJob(body.data);
      setFreeText("");
      setArtifact(null);
      await loadList();
    } finally {
      setBusy(false);
    }
  };

  const submitTurn = async (payload: { choice?: number; message?: string }) => {
    if (!selectedId || !job || job.status !== "collecting") {
      return;
    }
    setBusy(true);
    setJobErr(null);
    try {
      const res = await fetch(`/api/strategy-jobs/${selectedId}/turns`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await parseJson<{ data?: StrategyJobRow; error?: string }>(res);
      if (!res.ok || !body?.data) {
        const rawMessage = body?.error ?? `Turn failed (${res.status})`;
        setJobErr(toFriendlyStrategyJobsMessage(rawMessage, `Turn failed (${res.status})`));
        return;
      }
      setJob(body.data);
      setFreeText("");
      await loadList();
      if (body.data.status === "slots_complete") {
        void loadArtifactOnce(selectedId);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Strategy job orchestrator"
      className="mb-8 rounded-xl border border-[color:var(--xf-border-500)] bg-[color:var(--xf-surface-800)] p-4 text-[color:var(--xf-text-200)]"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            className="xoptions-strategy-jobs-toggle"
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span
              aria-hidden
              className={`xoptions-strategy-jobs-toggle__chev ${
                expanded ? "xoptions-strategy-jobs-toggle__chev--open" : ""
              }`}
            >
              ▸
            </span>
            <span className="xoptions-strategy-jobs-toggle__title">
              Hardcore strategy jobs
            </span>
          </button>
          <p className="mt-1 max-w-prose text-xs text-[color:var(--xf-text-400)]">
            {expanded ? (
              <>
                Slot collection via Spring{" "}
                <code className="text-[color:var(--xf-text-300)]">/api/strategy-jobs</code> (BFF). After{" "}
                <span className="text-[color:var(--xf-text-200)]">slots_complete</span>, the finalizer runs - this
                panel polls for the artifact.
              </>
            ) : (
              <>Collapsed. Expand to view and manage strategy jobs.</>
            )}
          </p>
        </div>
        {expanded ? (
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-[color:var(--xf-border-500)] bg-[color:var(--xf-surface-700)] px-3 py-1.5 text-xs font-medium text-[color:var(--xf-text-100)] disabled:opacity-50"
              disabled={busy}
              type="button"
              onClick={() => void loadList()}
            >
              Refresh list
            </button>
            <button
              className="rounded-lg bg-[color:var(--xf-gain-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--xf-surface-900)] disabled:opacity-50"
              disabled={busy}
              type="button"
              onClick={() => void createJob()}
            >
              New job
            </button>
          </div>
        ) : null}
      </div>

      {!expanded ? null : (
        <>
          {listErr ? (
            <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {listErr}
              {listErr.includes("503") || listErr.toLowerCase().includes("unavailable") ? (
                <>
                  {" "}
                  You can continue using the rest of xOptions while this reconnects.
                </>
              ) : null}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
            <div>
              <h3 className="mb-2 text-xs font-medium text-[color:var(--xf-text-400)]">Recent jobs</h3>
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                {jobs.length === 0 ? <li className="text-[color:var(--xf-text-500)]">No jobs yet.</li> : null}
                {jobs.map((j) => (
                  <li key={j.jobId}>
                    <button
                      className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                        selectedId === j.jobId
                          ? "bg-[color:var(--xf-surface-600)] text-[color:var(--xf-text-100)]"
                          : "hover:bg-[color:var(--xf-surface-700)]"
                      }`}
                      type="button"
                      onClick={() => {
                        setSelectedId(j.jobId);
                        setArtifact(null);
                      }}
                    >
                      <span className="font-mono text-[10px] text-[color:var(--xf-text-500)]">{j.jobId.slice(-8)}</span>
                      <span className="ml-2 text-[color:var(--xf-text-300)]">{j.status}</span>
                      {j.artifactStatus ? (
                        <span className="ml-1 text-[color:var(--xf-text-500)]">· {j.artifactStatus}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0">
              {!selectedId ? (
                <p className="text-sm text-[color:var(--xf-text-500)]">Select a job or create a new one.</p>
              ) : !job ? (
                <p className="text-sm text-[color:var(--xf-text-500)]">{jobErr ?? "Loading…"}</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--xf-text-400)]">
                    <span>
                      Job <span className="font-mono text-[color:var(--xf-text-200)]">{job.jobId}</span>
                    </span>
                    <span>·</span>
                    <span>{job.status}</span>
                    {job.correlationId ? (
                      <>
                        <span>·</span>
                        <span className="font-mono">{job.correlationId.slice(0, 8)}…</span>
                      </>
                    ) : null}
                    <Link className="ml-auto text-[color:var(--xf-gain-green)] underline" href="/xchat">
                      xChat
                    </Link>
                  </div>

                  {job.status === "collecting" && job.nextPrompt ? (
                    <div>
                      <p className="mb-2 text-sm font-medium text-[color:var(--xf-text-100)]">{job.nextPrompt}</p>
                      {job.nextChoices && job.nextChoices.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {job.nextChoices.map((c, i) => (
                            <button
                              key={c}
                              className="rounded-lg border border-[color:var(--xf-border-500)] bg-[color:var(--xf-surface-700)] px-3 py-1.5 text-xs disabled:opacity-50"
                              disabled={busy}
                              type="button"
                              onClick={() => void submitTurn({ choice: i + 1 })}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <form
                          className="flex flex-wrap gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const t = freeText.trim();
                            if (!t) return;
                            void submitTurn({ message: t });
                          }}
                        >
                          <input
                            className="min-w-[12rem] flex-1 rounded-lg border border-[color:var(--xf-border-500)] bg-[color:var(--xf-surface-900)] px-3 py-2 text-sm text-[color:var(--xf-text-100)]"
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                          />
                          <button
                            className="rounded-lg bg-[color:var(--xf-gain-green)] px-4 py-2 text-sm font-semibold text-[color:var(--xf-surface-900)] disabled:opacity-50"
                            disabled={busy}
                            type="submit"
                          >
                            Submit
                          </button>
                        </form>
                      )}
                    </div>
                  ) : null}

                  {jobErr ? <p className="text-xs text-red-300">{jobErr}</p> : null}

                  {job.status === "slots_complete" ? (
                    <div className="rounded-lg border border-[color:var(--xf-border-500)] bg-[color:var(--xf-surface-900)] p-3">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--xf-text-400)]">
                        Artifact
                      </h3>
                      {artifactErr && !artifact ? (
                        <p className="text-xs text-amber-200">{artifactErr}</p>
                      ) : null}
                      {!artifact ? (
                        <p className="text-xs text-[color:var(--xf-text-500)]">Polling finalizer…</p>
                      ) : artifact.artifactStatus === "pending" || artifact.artifactStatus === "running" ? (
                        <p className="text-xs text-[color:var(--xf-text-400)]">
                          Status: <strong>{artifact.artifactStatus}</strong> — still running.
                        </p>
                      ) : artifact.artifactStatus === "failed" ? (
                        <div className="text-xs text-red-300">
                          <p>
                            <strong>{artifact.errorCode ?? "failed"}</strong>
                          </p>
                          <p>{artifact.errorMessage}</p>
                        </div>
                      ) : artifact.artifactStatus === "ready" ? (
                        <div className="space-y-3">
                          {artifact.artifactModel ? (
                            <p className="text-[10px] text-[color:var(--xf-text-500)]">Model: {artifact.artifactModel}</p>
                          ) : null}
                          {artifact.artifactMarkdown ? (
                            <div className="xchat-md-scope max-h-[28rem] overflow-y-auto rounded-md border border-[color:var(--xf-border-600)] bg-[color:var(--xf-surface-800)] p-2">
                              <XchatMarkdownBody content={artifact.artifactMarkdown} />
                            </div>
                          ) : null}
                          {artifact.artifactJson ? (
                            <pre className="max-h-48 overflow-auto rounded-md border border-[color:var(--xf-border-600)] bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-[color:var(--xf-text-200)]">
                              {JSON.stringify(artifact.artifactJson, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs">{artifact.artifactStatus}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
