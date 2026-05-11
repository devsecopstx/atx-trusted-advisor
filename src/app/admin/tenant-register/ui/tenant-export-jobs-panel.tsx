"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type ArtifactSummary = { kind: string; filename: string; byteLength: number };

type ExportJobRow = {
  jobId: string;
  status: string;
  kinds: string[];
  createdAt: string;
  completedAt?: string;
  error?: string;
  artifacts?: ArtifactSummary[];
};

type ListResponse = {
  data: { tenantId: string; jobs: ExportJobRow[] };
};

type PostResponse = {
  data: ExportJobRow;
  message?: string;
};

type Props = {
  tenantId: string;
};

export function TenantExportJobsPanel({ tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ExportJobRow[]>([]);
  const [queueYaml, setQueueYaml] = useState(true);
  const [queueCsv, setQueueCsv] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const base = useMemo(
    () => `/api/admin/tenants/${encodeURIComponent(tenantId)}/export-jobs`,
    [tenantId]
  );

  const load = useCallback(async () => {
    if (!tenantId.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(base, { cache: "no-store" });
      const json = await parseJson<ListResponse>(res);
      setJobs(json.data.jobs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load export jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [base, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const enqueue = useCallback(async () => {
    const kinds: string[] = [];
    if (queueYaml) {
      kinds.push("live_spec_yaml");
    }
    if (queueCsv) {
      kinds.push("bootstrap_audit_csv");
    }
    if (kinds.length === 0) {
      setError("Select at least one export kind.");
      return;
    }
    setBusy(true);
    setHint(null);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kinds })
      });
      const json = await parseJson<PostResponse>(res);
      setHint(json.message ?? "Queued.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enqueue failed");
    } finally {
      setBusy(false);
    }
  }, [base, queueYaml, queueCsv, load]);

  const downloadUrl = (jobId: string, kind: string) =>
    `${base}/${encodeURIComponent(jobId)}/artifact/${encodeURIComponent(kind)}`;

  return (
    <section className="panel stack-gap mt-8">
      <div className="panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Export jobs (background)</h2>
          <p className="status-text text-sm">
            Queue a live tenant-spec YAML (Mongo → v1-shaped doc) and/or bootstrap audit CSV (
            <code className="font-mono text-xs">tenant_provision_bootstrap</code>, up to 5k rows). Scheduled task
            category <code className="font-mono text-xs">tenant_export_worker</code> drains{" "}
            <code className="font-mono text-xs">tenant_admin_export_jobs</code> — create one row under{" "}
            <strong>Admin → Tasks</strong> or click <strong>Run</strong> after enqueue.
          </p>
        </div>
        <button type="button" className="cta cta-secondary text-sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={queueYaml} onChange={(e) => setQueueYaml(e.target.checked)} />
          Live spec YAML
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={queueCsv} onChange={(e) => setQueueCsv(e.target.checked)} />
          Bootstrap audit CSV
        </label>
        <button type="button" className="cta text-sm" disabled={busy} onClick={() => void enqueue()}>
          {busy ? "Queueing…" : "Queue export"}
        </button>
      </div>

      {hint ? (
        <p className="text-sm text-[var(--xf-gain-green)]" role="status">
          {hint}
        </p>
      ) : null}
      {loading ? <p className="status-text text-sm">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-[var(--xf-warning-400)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[var(--xf-surface-800)]">
              <th className="p-2 font-semibold">Created (UTC)</th>
              <th className="p-2 font-semibold">Status</th>
              <th className="p-2 font-semibold">Kinds</th>
              <th className="p-2 font-semibold">Downloads</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="p-4 text-[var(--xf-text-400)]">
                  No export jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr
                  key={j.jobId}
                  className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)]"
                >
                  <td className="p-2 font-mono text-xs text-[var(--xf-text-300)]">{j.createdAt}</td>
                  <td className="p-2">
                    <span className="font-medium">{j.status}</span>
                    {j.error ? (
                      <span className="mt-1 block text-xs text-[var(--xf-warning-400)]">{j.error}</span>
                    ) : null}
                  </td>
                  <td className="p-2 font-mono text-xs">{j.kinds.join(", ")}</td>
                  <td className="p-2">
                    {j.status === "completed" && j.artifacts?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {j.artifacts.map((a) => (
                          <a
                            key={a.kind}
                            className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
                            href={downloadUrl(j.jobId, a.kind)}
                          >
                            {a.kind}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--xf-text-500)]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
