"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type TenantRegisterAdminRow = {
  userId: string;
  email: string;
  displayName: string;
  isDefaultSessionTenant: boolean;
};

type TenantRegisterRow = {
  tenantId: string;
  slug: string;
  name: string;
  isPlatformDefault: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceLimits: Record<string, unknown> | null;
  tenantPreferences: Record<string, unknown> | null;
  tenantAdmins: TenantRegisterAdminRow[];
};

function formatRegisterJson(value: Record<string, unknown> | null): string {
  if (value === null) {
    return "—";
  }
  return JSON.stringify(value, null, 2);
}

export function TenantRegisterConsole() {
  const [status, setStatus] = useState("Loading…");
  const [rows, setRows] = useState<TenantRegisterRow[]>([]);

  const load = useCallback(async () => {
    await Promise.resolve();
    setStatus("Loading…");
    try {
      const payload = await parseJson<{ data: TenantRegisterRow[] }>(
        await fetch("/api/admin/tenants/register")
      );
      setRows(payload.data);
      setStatus(`Loaded ${payload.data.length} tenant(s).`);
    } catch (e) {
      setRows([]);
      setStatus(e instanceof Error ? e.message : "Failed to load tenant register");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="panel stack-gap">
      <div className="panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Tenants</h2>
          <p className="status-text text-sm">
            Read-only: Mongo tenant row, stored workspace limits / tenant preferences, and tenant_admin directory.
          </p>
        </div>
        <button type="button" className="cta cta-secondary" onClick={() => void load()}>
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
      </div>
      <p className="status-text text-sm" role="status">
        {status}
      </p>
      <div className="crud-table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Tenant id</th>
              <th>Slug</th>
              <th>Platform default</th>
              <th>Workspace limits</th>
              <th>Tenant preferences</th>
              <th>Tenant admins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tenantId}>
                <td className="align-top">
                  <div className="font-semibold">{row.name}</div>
                  <div className="status-text text-xs opacity-80">
                    updated {new Date(row.updatedAt).toLocaleString()}
                  </div>
                </td>
                <td className="align-top">
                  <code className="font-mono text-xs break-all">{row.tenantId}</code>
                </td>
                <td className="align-top">
                  <code className="font-mono text-sm">{row.slug}</code>
                </td>
                <td className="align-top">{row.isPlatformDefault ? "Yes" : "—"}</td>
                <td className="align-top" style={{ maxWidth: 280 }}>
                  <pre
                    className="m-0 max-h-52 overflow-auto rounded p-2 font-mono text-xs leading-snug whitespace-pre-wrap break-all"
                    style={{
                      background: "var(--xf-surface-800)",
                      color: "var(--xf-text-200)"
                    }}
                  >
                    {formatRegisterJson(row.workspaceLimits)}
                  </pre>
                </td>
                <td className="align-top" style={{ maxWidth: 280 }}>
                  <pre
                    className="m-0 max-h-52 overflow-auto rounded p-2 font-mono text-xs leading-snug whitespace-pre-wrap break-all"
                    style={{
                      background: "var(--xf-surface-800)",
                      color: "var(--xf-text-200)"
                    }}
                  >
                    {formatRegisterJson(row.tenantPreferences)}
                  </pre>
                </td>
                <td className="align-top" style={{ maxWidth: 360 }}>
                  {row.tenantAdmins.length === 0 ? (
                    <span className="status-text text-sm">No tenant_admin membership</span>
                  ) : (
                    <ul className="m-0 list-none space-y-2 p-0">
                      {row.tenantAdmins.map((a) => (
                        <li key={a.userId}>
                          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                            {a.isDefaultSessionTenant ? (
                              <span
                                className="shrink-0"
                                style={{ color: "var(--xf-gain-green)" }}
                                title="Default session tenant for this user"
                                aria-label="Default session tenant for this user"
                              >
                                ●
                              </span>
                            ) : null}
                            <span className="font-medium">{a.displayName}</span>
                          </div>
                          <div className="break-all text-sm opacity-90">{a.email || "—"}</div>
                          <code className="font-mono text-xs opacity-75 break-all">{a.userId}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
