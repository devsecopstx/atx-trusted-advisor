"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type DrillPayload = {
  data: {
    enabled: boolean;
    envEnabled: boolean;
  };
};

export function TenantUxFailClosedDrillToggle() {
  const [enabled, setEnabled] = useState(false);
  const [envEnabled, setEnvEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await parseJson<DrillPayload>(
        await fetch("/api/admin/platform/tenant-ux/fail-closed-drill", { cache: "no-store" })
      );
      setEnabled(payload.data.enabled);
      setEnvEnabled(payload.data.envEnabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drill mode");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = useCallback(
    async (nextEnabled: boolean) => {
      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const payload = await parseJson<DrillPayload>(
          await fetch("/api/admin/platform/tenant-ux/fail-closed-drill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: nextEnabled })
          })
        );
        setEnabled(payload.data.enabled);
        setEnvEnabled(payload.data.envEnabled);
        setStatus(payload.data.enabled ? "Fail-closed drill enabled for this browser session." : "Fail-closed drill disabled.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update drill mode");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return (
    <div className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_15%,transparent)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Tenant UX fail-closed drill</p>
          <p className="status-text text-xs">
            Session-scoped cookie override for middleware outage drills. Global env is{" "}
            <strong>{envEnabled ? "ON" : "OFF"}</strong>.
          </p>
        </div>
        <button className="cta cta-secondary text-sm" type="button" disabled={busy} onClick={() => void onToggle(!enabled)}>
          {busy ? "Saving…" : enabled ? "Disable drill" : "Enable drill"}
        </button>
      </div>
      {status ? <p className="mt-2 text-sm text-[var(--xf-gain-green)]">{status}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
