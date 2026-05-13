"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import type { DataPlaneWriteHealthPayload, RegisteredWriteDisposition } from "@/lib/data-plane-write-health";

type Payload = { data: DataPlaneWriteHealthPayload };

export function DataPlaneHealthPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DataPlaneWriteHealthPayload | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/platform/data-plane-health", { cache: "no-store" });
      const json = await parseJson<Payload>(res);
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data-plane health");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cat = payload?.catalog;
  const rt = payload?.runtime;

  return (
    <section className="panel stack-gap">
      <div className="panel-header">
        <h2>Data ownership health (BFF registry)</h2>
        <p>
          Share of <strong>HTTP write verbs</strong> on routes listed in{" "}
          <code className="text-xs">bff-proxy-routes.ts</code> that are <strong>Spring-authoritative</strong> when the
          product BFF gate is on — versus writes that intentionally stay on Next + Mongo. This is a{" "}
          <strong>configuration inventory</strong>, not live traffic percentages.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="cta cta-secondary text-sm" type="button" disabled={busy} onClick={() => void load()}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? <p className="status-text status-error text-sm">{error}</p> : null}

      {cat && rt ? (
        <div className="stack-gap text-sm">
          <div className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[var(--xf-surface-800)] p-4">
            <p className="font-medium text-[var(--xf-text-200)]">Runtime</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--xf-text-300)]">
              <li>
                <code className="text-xs">ATXFINANCE_BACKEND_ORIGIN</code>:{" "}
                {rt.backendOriginConfigured ? (
                  <>
                    set (<span className="font-mono text-xs">{rt.backendOriginHostHint ?? "—"}</span>)
                  </>
                ) : (
                  "not set"
                )}
              </li>
              <li>
                BFF product gate active:{" "}
                <span className={rt.bffProductPlaneGateActive ? "text-[var(--xf-gain-green)]" : ""}>
                  {rt.bffProductPlaneGateActive ? "yes" : "no"}
                </span>
                {rt.bffInactiveReason === "origin_unset" ? " — JVM URL unset." : null}
                {rt.bffInactiveReason === "dev_loopback_skip" ? " — dev/test skips loopback proxy (see backend-bff)." : null}
              </li>
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[var(--xf-surface-800)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">BFF write rows</p>
              <p className="mt-1 font-mono text-2xl text-[var(--xf-text-100)]">{cat.bffRegisteredWritesTotal}</p>
            </div>
            <div className="rounded border border-[color-mix(in_srgb,var(--xf-gain-green)_25%,transparent)] bg-[var(--xf-surface-800)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Spring when gate on</p>
              <p className="mt-1 font-mono text-2xl text-[var(--xf-gain-green)]">
                {cat.springAuthoritativeWhenGateOn}
                {cat.springSharePercentWhenGateOn !== null ? (
                  <span className="ml-2 text-base text-[var(--xf-text-300)]">
                    ({cat.springSharePercentWhenGateOn}%)
                  </span>
                ) : null}
              </p>
            </div>
            <div className="rounded border border-[color-mix(in_srgb,var(--xf-lightning-yellow)_30%,transparent)] bg-[var(--xf-surface-800)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--xf-text-400)]">Next (registered)</p>
              <p className="mt-1 font-mono text-2xl text-[var(--xf-lightning-yellow)]">
                {cat.legacyNextRegisteredWrites}
                {cat.legacyRegisteredSharePercent !== null ? (
                  <span className="ml-2 text-base text-[var(--xf-text-300)]">
                    ({cat.legacyRegisteredSharePercent}%)
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <details className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_12%,transparent)] bg-[var(--xf-surface-900)] p-3">
            <summary className="cursor-pointer text-[var(--xf-text-200)]">Per-route write disposition</summary>
            <RegisteredWriteTable rows={payload.registeredWriteRows} />
          </details>
        </div>
      ) : !busy && !error ? (
        <p className="text-sm text-[var(--xf-text-400)]">No data.</p>
      ) : null}
    </section>
  );
}

function RegisteredWriteTable({ rows }: { rows: readonly RegisteredWriteDisposition[] }) {
  return (
    <div className="mt-3 max-h-72 overflow-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_15%,transparent)] text-[var(--xf-text-400)]">
            <th className="py-2 pr-2">Method</th>
            <th className="py-2 pr-2">Path</th>
            <th className="py-2">Disposition</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.method}:${r.pathTemplate}`}
              className="border-b border-[color-mix(in_srgb,var(--xf-text-100)_8%,transparent)]"
            >
              <td className="py-1.5 pr-2 font-mono">{r.method}</td>
              <td className="py-1.5 pr-2 font-mono text-[var(--xf-text-300)]">{r.pathTemplate}</td>
              <td className="py-1.5 text-[var(--xf-text-300)]">
                {r.disposition === "spring_when_bff_gate_on" ? (
                  <span className="text-[var(--xf-gain-green)]">Spring</span>
                ) : (
                  <span className="text-[var(--xf-lightning-yellow)]" title={r.reason}>
                    Next
                    {r.reason && r.reason.length > 56 ? ` — ${r.reason.slice(0, 54)}…` : r.reason ? ` — ${r.reason}` : ""}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
