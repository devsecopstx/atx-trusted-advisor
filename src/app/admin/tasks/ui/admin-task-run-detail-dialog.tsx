"use client";

import { useCallback, useEffect, useId, useRef } from "react";

import { formatDateTimeInTimeZone } from "@/lib/admin-tasks-display-timezone";
import {
    isKnownScheduledTaskCategory,
    scheduledTaskCategoryDisplayName
} from "@/lib/scheduled-task-category-display";

export type AdminTaskRunExecutorDetail = {
  runtime: string;
  environment: string;
  label: string;
  service?: string;
  revision?: string;
  host?: string;
  delegateFrom?: string;
};

export type AdminTaskRunDetail = {
  _id?: string;
  tenantId?: string;
  taskId: string;
  taskName: string;
  category: string;
  triggeredBy: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output: string;
  executor?: AdminTaskRunExecutorDetail;
};

type AdminTaskRunDetailDialogProps = {
  run: AdminTaskRunDetail | null;
  displayTimeZone: string;
  onClose: () => void;
};

function outputPreview(output: string, max = 120): string {
  const trimmed = output.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}

export function AdminTaskRunDetailDialog({
  run,
  displayTimeZone,
  onClose
}: AdminTaskRunDetailDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const copyOutput = useCallback(async () => {
    if (!run?.output?.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(run.output);
    } catch {
      /* ignore */
    }
  }, [run?.output]);

  useEffect(() => {
    if (!run) {
      return;
    }
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, onClose]);

  if (!run) {
    return null;
  }

  const hasOutput = run.output.trim().length > 0;
  const categoryKnown = isKnownScheduledTaskCategory(run.category);
  const categoryLabel = scheduledTaskCategoryDisplayName(run.category);

  return (
    <div className="admin-task-run-detail__backdrop" role="presentation" onClick={onClose}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-task-run-detail surface-card xf-widget"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-task-run-detail__header">
          <div>
            <h2 className="admin-task-run-detail__title" id={titleId}>
              {run.taskName}
            </h2>
            <p className="admin-task-run-detail__meta status-text">
              <code className="font-mono text-xs">{run.category}</code>
              {categoryLabel ? (
                <>
                  {" · "}
                  {categoryLabel}
                </>
              ) : (
                <span className="status-warn"> · unknown category</span>
              )}
              {" · "}
              <span
                className={`status-badge status-${run.status === "success" ? "ready" : run.status === "failed" ? "error" : "pending"}`}
              >
                {run.status}
              </span>
            </p>
          </div>
          <button
            ref={closeRef}
            aria-label="Close run details"
            className="tiny-button"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <dl className="admin-task-run-detail__facts">
          <dt>Category</dt>
          <dd>
            <code className="font-mono text-xs">{run.category}</code>
            {!categoryKnown ? (
              <p className="status-text status-warn" style={{ marginTop: "0.35rem" }}>
                Not a known executor slug — fix the job&apos;s category on the Jobs tab (e.g.{" "}
                <code className="font-mono text-xs">marketing_post</code>, not the display label).
              </p>
            ) : categoryLabel ? (
              <p className="status-text" style={{ marginTop: "0.35rem" }}>
                {categoryLabel}
              </p>
            ) : null}
          </dd>
          <dt>Executed on</dt>
          <dd>
            {run.executor?.label ? (
              <>
                <span>{run.executor.label}</span>
                <p className="status-text" style={{ marginTop: "0.35rem" }}>
                  Runtime: <code className="font-mono text-xs">{run.executor.runtime}</code>
                  {" · "}
                  Environment:{" "}
                  <code className="font-mono text-xs">{run.executor.environment}</code>
                  {run.executor.service ? (
                    <>
                      {" · "}
                      Service: <code className="font-mono text-xs">{run.executor.service}</code>
                    </>
                  ) : null}
                  {run.executor.revision ? (
                    <>
                      {" · "}
                      Revision: <code className="font-mono text-xs">{run.executor.revision}</code>
                    </>
                  ) : null}
                  {run.executor.host ? (
                    <>
                      {" · "}
                      Host: <code className="font-mono text-xs">{run.executor.host}</code>
                    </>
                  ) : null}
                </p>
              </>
            ) : (
              <span className="status-text status-warn">Not recorded (run before executor tracking)</span>
            )}
          </dd>
          <dt>Triggered by</dt>
          <dd>{run.triggeredBy}</dd>
          <dt>Started</dt>
          <dd>{formatDateTimeInTimeZone(run.startedAt, displayTimeZone)}</dd>
          <dt>Completed</dt>
          <dd>
            {run.completedAt
              ? formatDateTimeInTimeZone(run.completedAt, displayTimeZone)
              : "—"}
          </dd>
          <dt>Duration</dt>
          <dd>{run.durationMs != null ? `${run.durationMs} ms` : "—"}</dd>
          <dt>Run id</dt>
          <dd>
            <code className="font-mono text-xs">{run._id ?? "—"}</code>
          </dd>
          <dt>Job id</dt>
          <dd>
            <code className="font-mono text-xs">{run.taskId}</code>
          </dd>
          {run.tenantId ? (
            <>
              <dt>Tenant id</dt>
              <dd>
                <code className="font-mono text-xs">{run.tenantId}</code>
              </dd>
            </>
          ) : null}
        </dl>

        <div className="admin-task-run-detail__output-section">
          <div className="admin-task-run-detail__output-toolbar">
            <h3 className="admin-task-run-detail__output-title">
              {run.status === "failed" ? "Error / log output" : "Run output"}
            </h3>
            <button
              className="tiny-button cta cta-secondary"
              disabled={!hasOutput}
              type="button"
              onClick={() => void copyOutput()}
            >
              Copy
            </button>
          </div>
          {hasOutput ? (
            <pre className="admin-task-run-detail__output-pre">{run.output}</pre>
          ) : (
            <p className="status-text status-warn">
              No output was stored for this run. Re-run the job or check server logs for the run id above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function taskRunOutputSnippet(output: string, max = 80): string {
  const preview = outputPreview(output, max);
  return preview || "—";
}
