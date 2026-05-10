"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type TenantUxEvent = {
  type: "tenant_ux_metric" | "tenant_ux_policy_fetch_error";
  tenantId: string;
  pathname?: string;
  metric?: string;
  ms?: number;
  createdAt: string;
  error?: string;
};

type Payload = {
  data: {
    counters: {
      tenant_ux_route_forbidden_total: number;
      tenant_ux_policy_fetch_latency_ms_p95: number | null;
      tenant_ux_policy_unavailable_total: number;
    };
    events: TenantUxEvent[];
    replay: TenantUxEvent[];
  };
};

export function TenantUxObservabilityPanel() {
  const [tenantId, setTenantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload["data"] | null>(null);

  const load = useCallback(async (replayTenantId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tenantId.trim()) {
        params.set("tenantId", tenantId.trim());
      }
      if (replayTenantId?.trim()) {
        params.set("replayTenantId", replayTenantId.trim());
      }
      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      const data = await parseJson<Payload>(
        await fetch(`/api/admin/platform/tenant-ux/observability${suffix}`, {
          cache: "no-store"
        })
      );
      setPayload(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenant UX observability");
    } finally {
      setBusy(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="panel stack-gap">
      <div className="panel-header">
        <h2>Tenant UX observability</h2>
        <p>Last 50 tenant UX metric/error events plus 24h replay by tenant.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Tenant filter / replay id
          <input
            className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[var(--xf-surface-800)] px-3 py-2 font-mono text-xs"
            placeholder="24-char tenant ObjectId"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          />
        </label>
        <button className="cta cta-secondary text-sm" type="button" disabled={busy} onClick={() => void load()}>
          {busy ? "Loading…" : "Refresh"}
        </button>
        <button
          className="cta cta-secondary text-sm"
          type="button"
          disabled={busy || !tenantId.trim()}
          onClick={() => void load(tenantId)}
        >
          Replay last 24h
        </button>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {payload ? (
        <>
          <div className="grid gap-2 md:grid-cols-3">
            <p className="status-text text-sm">forbidden: {payload.counters.tenant_ux_route_forbidden_total}</p>
            <p className="status-text text-sm">
              p95 latency: {payload.counters.tenant_ux_policy_fetch_latency_ms_p95 ?? "n/a"} ms
            </p>
            <p className="status-text text-sm">unavailable: {payload.counters.tenant_ux_policy_unavailable_total}</p>
          </div>
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Tenant</th>
                  <th>Type</th>
                  <th>Metric</th>
                  <th>Path</th>
                  <th>ms</th>
                </tr>
              </thead>
              <tbody>
                {payload.events.map((event, idx) => (
                  <tr key={`${event.tenantId}-${event.createdAt}-${idx}`}>
                    <td>{new Date(event.createdAt).toLocaleString()}</td>
                    <td>
                      <code className="text-xs">{event.tenantId}</code>
                    </td>
                    <td>{event.type}</td>
                    <td>{event.metric ?? "—"}</td>
                    <td>{event.pathname ?? "—"}</td>
                    <td>{typeof event.ms === "number" ? event.ms : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payload.replay.length > 0 ? (
            <details className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_15%,transparent)] p-2">
              <summary className="cursor-pointer text-sm font-semibold">
                Replay ({payload.replay.length} events)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-[var(--xf-surface-800)] p-2 text-xs">
                {JSON.stringify(payload.replay, null, 2)}
              </pre>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
