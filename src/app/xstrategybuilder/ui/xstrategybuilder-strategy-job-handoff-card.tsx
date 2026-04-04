"use client";

import { useEffect, useMemo, useState } from "react";

import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";

type StrategyJobRow = {
  jobId: string;
  status: string;
  artifactStatus?: string | null;
  updatedAt?: number;
};

type StrategyJobsListPayload = {
  data?: {
    jobs?: StrategyJobRow[];
  };
  error?: string;
  message?: string;
};

type StrategyJobArtifactPayload = {
  data?: {
    artifactStatus: string;
    artifactMarkdown?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  };
  error?: string;
  message?: string;
};

type Props = {
  initialJobId?: string | null;
};

function formatRelativeUpdatedAt(epochMs: number | undefined): string {
  if (!epochMs || !Number.isFinite(epochMs)) {
    return "updated recently";
  }
  const sec = Math.max(1, Math.floor((Date.now() - epochMs) / 1000));
  if (sec < 60) {
    return `${sec}s ago`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

export function XstrategybuilderStrategyJobHandoffCard({ initialJobId = null }: Props) {
  const [jobs, setJobs] = useState<StrategyJobRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<{
    status: string;
    markdown?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.jobId === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    let active = true;
    async function loadJobs() {
      setLoadingJobs(true);
      setJobsError(null);
      try {
        const res = await fetch("/api/strategy-jobs?limit=12", { credentials: "include" });
        const payload = (await res.json().catch(() => ({}))) as StrategyJobsListPayload;
        if (!res.ok) {
          if (!active) return;
          setJobs([]);
          setJobsError(payload.message ?? payload.error ?? `Could not load strategy jobs (${res.status}).`);
          return;
        }
        if (!active) return;
        const rows = payload.data?.jobs ?? [];
        setJobs(rows);
        if (!selectedJobId && rows.length > 0) {
          setSelectedJobId(initialJobId ?? rows[0].jobId);
        }
      } finally {
        if (active) {
          setLoadingJobs(false);
        }
      }
    }
    void loadJobs();
    return () => {
      active = false;
    };
  }, [initialJobId, selectedJobId]);

  useEffect(() => {
    setArtifact(null);
    setArtifactError(null);
  }, [selectedJobId]);

  async function viewArtifact() {
    if (!selectedJobId) {
      return;
    }
    setArtifactLoading(true);
    setArtifactError(null);
    try {
      const res = await fetch(`/api/strategy-jobs/${encodeURIComponent(selectedJobId)}/artifact`, {
        credentials: "include"
      });
      const payload = (await res.json().catch(() => ({}))) as StrategyJobArtifactPayload;
      if (!res.ok || !payload.data) {
        setArtifact(null);
        setArtifactError(
          payload.message ?? payload.error ?? `Could not load artifact for ${selectedJobId} (${res.status}).`
        );
        return;
      }
      setArtifact({
        status: payload.data.artifactStatus,
        markdown: payload.data.artifactMarkdown ?? null,
        errorCode: payload.data.errorCode ?? null,
        errorMessage: payload.data.errorMessage ?? null
      });
    } finally {
      setArtifactLoading(false);
    }
  }

  return (
    <section className="xsb-panel" aria-label="xChat strategy job handoff">
      <div>
        <p className="xsb-friendly-section-label">xChat strategy handoff</p>
        <p className="xsb-friendly-hint xsb-friendly-hint--tight">
          Compliance workflow: xChat captures intent, strategy jobs collect required slots, and artifacts remain
          auditable before execution review.
        </p>
      </div>

      {jobsError ? (
        <p className="xsb-friendly-hint" style={{ color: "var(--xf-danger-400)" }}>
          {jobsError}
        </p>
      ) : null}
      {loadingJobs && jobs.length === 0 ? (
        <p className="xsb-friendly-hint">Loading strategy jobs…</p>
      ) : null}

      {jobs.length > 0 ? (
        <ul className="xsb-account-list" style={{ marginTop: 0 }}>
          {jobs.map((job) => (
            <li key={job.jobId}>
              <button
                type="button"
                className={`xsb-account-row${selectedJobId === job.jobId ? " xsb-account-row--active" : ""}`}
                onClick={() => setSelectedJobId(job.jobId)}
              >
                <span className="xsb-account-row-name">Job {job.jobId.slice(-8)}</span>
                <span className="xsb-account-row-meta">
                  {job.status}
                  {job.artifactStatus ? ` · artifact ${job.artifactStatus}` : ""}
                </span>
                <span className="xsb-account-row-meta">{formatRelativeUpdatedAt(job.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="xsb-actions">
        <button
          type="button"
          className="xsb-btn xsb-btn-primary"
          disabled={!selectedJobId || artifactLoading}
          onClick={() => void viewArtifact()}
        >
          {artifactLoading ? "Loading artifact…" : "View artifact"}
        </button>
      </div>

      {selectedJob ? (
        <p className="xsb-friendly-hint">
          Current status: <strong>{selectedJob.status}</strong>
          {selectedJob.artifactStatus ? ` · artifact ${selectedJob.artifactStatus}` : ""}
        </p>
      ) : null}

      {artifactError ? (
        <p className="xsb-friendly-hint" style={{ color: "var(--xf-danger-400)" }}>
          {artifactError}
        </p>
      ) : null}

      {artifact ? (
        <div className="xsb-builder-preview--friendly" style={{ marginTop: 0 }}>
          <p className="xsb-friendly-section-label">Artifact status: {artifact.status}</p>
          {artifact.status === "ready" && artifact.markdown ? (
            <div className="xchat-md-scope">
              <XchatMarkdownBody content={artifact.markdown} />
            </div>
          ) : null}
          {artifact.status === "failed" ? (
            <p className="xsb-friendly-hint" style={{ color: "var(--xf-danger-400)" }}>
              {artifact.errorCode ?? "artifact_failed"}
              {artifact.errorMessage ? ` — ${artifact.errorMessage}` : ""}
            </p>
          ) : null}
          {artifact.status !== "ready" && artifact.status !== "failed" ? (
            <p className="xsb-friendly-hint">Artifact is still processing. Refresh later.</p>
          ) : null}
          <p className="xsb-friendly-hint" style={{ marginTop: "0.5rem" }}>
            Not investment advice. Use this output as educational decision support and apply desk risk/compliance review
            before any order routing.
          </p>
        </div>
      ) : null}
    </section>
  );
}
