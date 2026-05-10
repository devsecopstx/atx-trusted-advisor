"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type BootstrapAuditEvent = {
  id: string;
  createdAt: string;
  actor: { userId?: string; email?: string; username?: string };
  details: Record<string, unknown>;
};

type BootstrapAuditResponse = {
  data: {
    tenantId: string;
    events: BootstrapAuditEvent[];
  };
};

type ReplayResponse = {
  data:
    | { didProvision: true; portfolioId: string; platformRole: string }
    | { didProvision: false; skippedReason: string };
};

type Props = {
  tenantId: string;
};

export function TenantBootstrapAuditPanel({ tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<BootstrapAuditEvent[]>([]);
  const [replayUserId, setReplayUserId] = useState("");
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/bootstrap-audit`,
        { cache: "no-store" }
      );
      const json = await parseJson<BootstrapAuditResponse>(res);
      setEvents(json.data.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bootstrap audit");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const replay = useCallback(async () => {
    const uid = replayUserId.trim().toLowerCase();
    if (!/^[a-f0-9]{24}$/.test(uid)) {
      setReplayStatus(null);
      setError("Replay user id must be a 24-character hex Mongo id.");
      return;
    }
    setReplayBusy(true);
    setReplayStatus(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/bootstrap-replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid })
        }
      );
      const json = await parseJson<ReplayResponse>(res);
      const d = json.data;
      if (d.didProvision) {
        setReplayStatus(`Provisioned · portfolio ${d.portfolioId} · role ${d.platformRole}`);
      } else {
        setReplayStatus(`Skipped: ${d.skippedReason}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Replay failed");
    } finally {
      setReplayBusy(false);
    }
  }, [tenantId, replayUserId, load]);

  return (
    <section className="panel stack-gap mt-8">
      <div className="panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Bootstrap activity</h2>
          <p className="status-text text-sm">
            Recent <code className="font-mono text-xs">tenant_provision_bootstrap</code> audit rows for this tenant.
            Replay runs the same idempotent path as login (membership required).
          </p>
        </div>
        <button type="button" className="cta cta-secondary text-sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? <p className="status-text text-sm">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-[var(--xf-warning-400)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)]">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[var(--xf-surface-800)]">
              <th className="p-2 font-semibold">When (UTC)</th>
              <th className="p-2 font-semibold">Actor</th>
              <th className="p-2 font-semibold">Trigger</th>
              <th className="p-2 font-semibold">Role</th>
              <th className="p-2 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="p-4 text-[var(--xf-text-400)]">
                  No bootstrap audit events yet.
                </td>
              </tr>
            ) : (
              events.map((ev) => {
                const details = ev.details;
                const trigger = typeof details.trigger === "string" ? details.trigger : "—";
                const role = typeof details.platformRole === "string" ? details.platformRole : "—";
                const ok = details.success === true;
                const fail = details.success === false;
                const portfolioId = typeof details.portfolioId === "string" ? details.portfolioId : "";
                const err = typeof details.error === "string" ? details.error : "";
                const resultLabel = ok
                  ? portfolioId
                    ? `ok · ${portfolioId.slice(0, 8)}…`
                    : "ok"
                  : fail
                    ? `fail · ${err.slice(0, 80)}`
                    : "—";
                return (
                  <tr
                    key={ev.id || ev.createdAt}
                    className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)]"
                  >
                    <td className="p-2 font-mono text-xs text-[var(--xf-text-300)]">{ev.createdAt}</td>
                    <td className="p-2 font-mono text-xs">{ev.actor?.userId ?? "—"}</td>
                    <td className="p-2">{trigger}</td>
                    <td className="p-2">{role}</td>
                    <td className="p-2 text-xs">{resultLabel}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] p-4">
        <p className="text-sm font-semibold text-[var(--xf-text-100)]">Replay bootstrap for user</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[14rem] flex-col gap-1">
            <span className="text-xs text-[var(--xf-text-400)]">core_users id (hex)</span>
            <input
              className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[var(--xf-surface-800)] px-3 py-2 font-mono text-sm text-[var(--xf-text-100)]"
              placeholder="64a1b2c3d4e5f67890123456"
              value={replayUserId}
              onChange={(e) => setReplayUserId(e.target.value)}
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="cta cta-secondary text-sm"
            disabled={replayBusy || !replayUserId.trim()}
            onClick={() => void replay()}
          >
            {replayBusy ? "Running…" : "Replay"}
          </button>
        </div>
        {replayStatus ? (
          <p className="text-sm text-[var(--xf-gain-green)]" role="status">
            {replayStatus}
          </p>
        ) : null}
      </div>
    </section>
  );
}
