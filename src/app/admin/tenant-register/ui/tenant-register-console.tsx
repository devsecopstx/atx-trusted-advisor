"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { AddIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";

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
  membershipCount: number;
  xchatTeamAttachmentsCollectionId: string | null;
  xchatTeamAttachmentsCollectionName: string | null;
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

function lastFourOfTenantId(tenantId: string): string {
  const t = tenantId.replace(/\s/g, "");
  if (t.length <= 4) {
    return t || "—";
  }
  return t.slice(-4);
}

function shortId(id: string | null): string {
  if (!id?.trim()) {
    return "—";
  }
  const t = id.trim();
  if (t.length <= 14) {
    return t;
  }
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

function accentHexFromPreferences(prefs: Record<string, unknown> | null): string {
  if (!prefs) {
    return DEFAULT_TENANT_ACCENT_HEX;
  }
  try {
    return normalizeXfAccentColor(prefs.xf_accent_color);
  } catch {
    return DEFAULT_TENANT_ACCENT_HEX;
  }
}

function jsonSummary(value: Record<string, unknown> | null): string {
  if (value === null) {
    return "null";
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return "{}";
  }
  return `${keys.length} key${keys.length === 1 ? "" : "s"}`;
}

function JsonToggleBlock({
  value,
  expandedId,
  isOpen,
  onToggle
}: {
  value: Record<string, unknown> | null;
  expandedId: string;
  isOpen: boolean;
  onToggle: (nextOpen: boolean) => void;
}) {
  const headingId = useId();
  return (
    <div className="tenant-register-json-block max-w-[min(100%,20rem)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="status-text text-xs">{jsonSummary(value)}</span>
        <button
          aria-controls={expandedId}
          aria-expanded={isOpen}
          className="text-xs font-semibold text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
          id={headingId}
          type="button"
          onClick={() => onToggle(!isOpen)}
        >
          {isOpen ? "Hide JSON" : "Show JSON"}
        </button>
      </div>
      {isOpen ? (
        <pre
          aria-labelledby={headingId}
          className="mt-2 max-h-52 overflow-auto rounded p-2 font-mono text-xs leading-snug whitespace-pre-wrap break-all"
          id={expandedId}
          style={{
            background: "var(--xf-surface-800)",
            color: "var(--xf-text-200)"
          }}
        >
          {formatRegisterJson(value)}
        </pre>
      ) : null}
    </div>
  );
}

export function TenantRegisterConsole() {
  const [status, setStatus] = useState("Loading…");
  const [rows, setRows] = useState<TenantRegisterRow[]>([]);
  const [jsonExpanded, setJsonExpanded] = useState<Record<string, boolean>>({});
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const setJsonOpen = useCallback((key: string, open: boolean) => {
    setJsonExpanded((prev) => ({ ...prev, [key]: open }));
  }, []);

  const load = useCallback(async () => {
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

  const deleteTenant = useCallback(
    async (tenantId: string, membershipCount: number, isPlatformDefault: boolean) => {
      if (isPlatformDefault || membershipCount > 0) {
        return;
      }
      if (!window.confirm(`Delete tenant ${tenantId}? This cannot be undone. No users must remain on this tenant.`)) {
        return;
      }
      setDeleteBusyId(tenantId);
      try {
        const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, { method: "DELETE" });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? res.statusText);
        }
        setStatus("Tenant deleted.");
        await load();
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeleteBusyId(null);
      }
    },
    [load]
  );

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (!cancelled) void load();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [load]);

  return (
    <section className="panel stack-gap">
      <div className="panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Tenants</h2>
          <p className="status-text text-sm">
            Mongo tenant row, membership counts, xChat team KB id/name when provisioned, workspace limits / tenant
            preferences, and tenant_admin directory. Delete is allowed only when membership count is zero (and not the
            platform default tenant).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            aria-label="Create new tenant — open form for slug, branding, and initial admin"
            className="tenant-register-create-link inline-flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--xf-text-100)_20%,transparent)] bg-[var(--xf-surface-800)] px-3 py-2 text-sm font-semibold text-[var(--xf-text-100)] shadow-sm transition-colors hover:border-[color-mix(in_srgb,var(--xf-gain-green)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--xf-surface-700)_85%,var(--xf-gain-green)_15%)]"
            href="/admin/tenant-register/create"
            title="Create new tenant — slug, display name, brand color, optional logo, initial admin"
          >
            <AddIcon className="h-4 w-4 shrink-0 text-[var(--xf-gain-green)]" />
            <span>Create tenant</span>
          </Link>
          <button type="button" className="cta cta-secondary" onClick={() => void load()}>
            <RefreshIcon className="crud-icon" /> Refresh
          </button>
        </div>
      </div>
      <p className="status-text text-sm" role="status">
        {status}
      </p>
      <div className="crud-table-wrap">
        <table className="crud-table">
          <thead>
            <tr>
              <th>Tenant id</th>
              <th>Last 4</th>
              <th>Tenant</th>
              <th>Slug</th>
              <th>Users</th>
              <th>xChat team KB</th>
              <th>Brand color</th>
              <th>Platform default</th>
              <th>Workspace</th>
              <th>Tenant prefs</th>
              <th>Tenant admins</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const accent = accentHexFromPreferences(row.tenantPreferences);
              const wsKey = `${row.tenantId}-workspace`;
              const prefKey = `${row.tenantId}-prefs`;
              return (
                <tr key={row.tenantId}>
                  <td className="align-top">
                    <code className="font-mono text-xs break-all">{row.tenantId}</code>
                  </td>
                  <td className="align-top">
                    <code className="font-mono text-sm tracking-wide">{lastFourOfTenantId(row.tenantId)}</code>
                  </td>
                  <td className="align-top">
                    <div className="font-semibold">{row.name}</div>
                    <div className="status-text text-xs opacity-80">
                      updated {new Date(row.updatedAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="align-top">
                    <code className="font-mono text-sm">{row.slug}</code>
                  </td>
                  <td className="align-top">
                    <span className="font-mono text-sm tabular-nums">{row.membershipCount}</span>
                  </td>
                  <td className="align-top max-w-[14rem]">
                    {row.xchatTeamAttachmentsCollectionName || row.xchatTeamAttachmentsCollectionId ? (
                      <div className="flex flex-col gap-1 text-sm">
                        <span className="font-medium leading-snug break-words">
                          {row.xchatTeamAttachmentsCollectionName ?? "—"}
                        </span>
                        <code
                          className="font-mono text-xs break-all text-[var(--xf-text-400)]"
                          title={row.xchatTeamAttachmentsCollectionId ?? undefined}
                        >
                          {shortId(row.xchatTeamAttachmentsCollectionId)}
                        </code>
                      </div>
                    ) : (
                      <span className="status-text text-sm">—</span>
                    )}
                  </td>
                  <td className="align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        aria-label={`Tenant accent ${accent}`}
                        className="inline-block h-8 w-8 shrink-0 rounded border border-[color-mix(in_srgb,var(--xf-text-100)_25%,transparent)] shadow-inner"
                        style={{ backgroundColor: accent }}
                        title={accent}
                      />
                      <code className="font-mono text-xs text-[var(--xf-text-300)]">{accent}</code>
                    </div>
                  </td>
                  <td className="align-top">{row.isPlatformDefault ? "Yes" : "—"}</td>
                  <td className="align-top">
                    <JsonToggleBlock
                      expandedId={`${wsKey}-panel`}
                      isOpen={Boolean(jsonExpanded[wsKey])}
                      value={row.workspaceLimits}
                      onToggle={(o) => setJsonOpen(wsKey, o)}
                    />
                  </td>
                  <td className="align-top">
                    <JsonToggleBlock
                      expandedId={`${prefKey}-panel`}
                      isOpen={Boolean(jsonExpanded[prefKey])}
                      value={row.tenantPreferences}
                      onToggle={(o) => setJsonOpen(prefKey, o)}
                    />
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
                  <td className="align-top">
                    <div className="flex flex-col gap-2">
                      <Link
                        className="text-sm font-semibold text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
                        href={`/admin/tenant-register/${encodeURIComponent(row.tenantId)}/edit`}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="text-left text-sm font-semibold text-[var(--xf-text-300)] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          Boolean(deleteBusyId) ||
                          row.isPlatformDefault ||
                          row.membershipCount > 0
                        }
                        title={
                          row.isPlatformDefault
                            ? "Cannot delete the platform default tenant"
                            : row.membershipCount > 0
                              ? `Delete disabled while ${row.membershipCount} user(s) are on this tenant`
                              : "Delete tenant document (no users)"
                        }
                        onClick={() => void deleteTenant(row.tenantId, row.membershipCount, row.isPlatformDefault)}
                      >
                        {deleteBusyId === row.tenantId ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
