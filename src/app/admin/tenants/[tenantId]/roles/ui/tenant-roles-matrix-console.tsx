"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type PlatformRole = "global_admin" | "advisor" | "operator" | "viewer";

type RouteCatalogEntry = {
  id: string;
  pathPattern: string;
  pathMatch: "prefix" | "exact";
  label: string;
  defaultVisibleForRoles: PlatformRole[];
};

type RouteCatalogPayload = {
  data: {
    catalog: {
      entries: RouteCatalogEntry[];
    };
  };
};

type RoleFlags = {
  canMutatePortfolios: boolean;
  canUseXChat: boolean;
  canRunTasks: boolean;
};

type RolePolicy = {
  allowedRoutes: string[];
  defaultLanding: string;
  flags: RoleFlags;
};

type TenantRolesPayload = {
  data: {
    tenantId: string;
    slug: string;
    name: string;
    roles: Record<PlatformRole, RolePolicy>;
  };
};

type TenantRegisterPayload = {
  data: Array<{
    tenantId: string;
    slug: string;
    name: string;
  }>;
};

const ROLE_ORDER: PlatformRole[] = ["global_admin", "advisor", "operator", "viewer"];

type Props = {
  tenantId: string;
};

function cloneRoles(input: Record<PlatformRole, RolePolicy>): Record<PlatformRole, RolePolicy> {
  return {
    global_admin: { ...input.global_admin, allowedRoutes: [...input.global_admin.allowedRoutes], flags: { ...input.global_admin.flags } },
    advisor: { ...input.advisor, allowedRoutes: [...input.advisor.allowedRoutes], flags: { ...input.advisor.flags } },
    operator: { ...input.operator, allowedRoutes: [...input.operator.allowedRoutes], flags: { ...input.operator.flags } },
    viewer: { ...input.viewer, allowedRoutes: [...input.viewer.allowedRoutes], flags: { ...input.viewer.flags } }
  };
}

function routeEnabled(policy: RolePolicy, routePath: string): boolean {
  return policy.allowedRoutes.includes(routePath);
}

function withRouteToggle(policy: RolePolicy, routePath: string, enabled: boolean): RolePolicy {
  const set = new Set(policy.allowedRoutes);
  if (enabled) {
    set.add(routePath);
  } else {
    set.delete(routePath);
  }
  return {
    ...policy,
    allowedRoutes: [...set].sort()
  };
}

export function TenantRolesMatrixConsole({ tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<RouteCatalogEntry[]>([]);
  const [rolePolicies, setRolePolicies] = useState<Record<PlatformRole, RolePolicy> | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogPayload, rolesPayload] = await Promise.all([
        parseJson<RouteCatalogPayload>(await fetch(`/api/admin/platform/route-catalog/${encodeURIComponent(tenantId)}`)),
        parseJson<TenantRolesPayload>(await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/roles`))
      ]);
      setCatalog(
        catalogPayload.data.catalog.entries
          .filter((entry) => entry.pathMatch === "prefix")
          .sort((a, b) => a.pathPattern.localeCompare(b.pathPattern))
      );
      setRolePolicies(cloneRoles(rolesPayload.data.roles));
      setTenantName(rolesPayload.data.name);
      setTenantSlug(rolesPayload.data.slug);
      setStatus("Loaded tenant role matrix.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenant roles");
      setStatus(null);
      setRolePolicies(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const routeRows = useMemo(() => catalog, [catalog]);

  const setRouteEnabled = useCallback((role: PlatformRole, routePath: string, enabled: boolean) => {
    setRolePolicies((prev) => {
      if (!prev) {
        return prev;
      }
      if (role === "global_admin") {
        return prev;
      }
      const next = cloneRoles(prev);
      next[role] = withRouteToggle(next[role], routePath, enabled);
      if (!next[role].allowedRoutes.includes(next[role].defaultLanding)) {
        next[role].defaultLanding = next[role].allowedRoutes[0] ?? next[role].defaultLanding;
      }
      return next;
    });
  }, []);

  const setAllForRole = useCallback((role: PlatformRole, enabled: boolean) => {
    setRolePolicies((prev) => {
      if (!prev || role === "global_admin") {
        return prev;
      }
      const next = cloneRoles(prev);
      const routes = routeRows.map((entry) => entry.pathPattern);
      next[role].allowedRoutes = enabled ? [...new Set(routes)].sort() : [];
      if (!next[role].allowedRoutes.includes(next[role].defaultLanding)) {
        next[role].defaultLanding = next[role].allowedRoutes[0] ?? "/portfolios";
      }
      return next;
    });
  }, [routeRows]);

  const saveAll = useCallback(async () => {
    if (!rolePolicies) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: rolePolicies })
      });
      const payload = await parseJson<TenantRolesPayload>(res);
      setRolePolicies(cloneRoles(payload.data.roles));
      setStatus("Saved full tenant role matrix.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [rolePolicies, tenantId]);

  const saveRole = useCallback(
    async (role: PlatformRole) => {
      if (!rolePolicies) {
        return;
      }
      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const target = rolePolicies[role];
        const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/roles/${role}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            allowedRoutes: target.allowedRoutes,
            defaultLanding: target.defaultLanding,
            flags: target.flags
          })
        });
        await parseJson<{ data: unknown }>(res);
        setStatus(`Saved ${role} policy.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Role save failed");
      } finally {
        setBusy(false);
      }
    },
    [rolePolicies, tenantId]
  );

  const applyToAllTenants = useCallback(async () => {
    if (!rolePolicies) {
      return;
    }
    if (!window.confirm("Apply current matrix to all tenants?")) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const tenants = await parseJson<TenantRegisterPayload>(await fetch("/api/admin/tenants/register"));
      const failures: string[] = [];
      for (const row of tenants.data) {
        const response = await fetch(`/api/admin/tenants/${encodeURIComponent(row.tenantId)}/roles`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles: rolePolicies })
        });
        if (!response.ok) {
          failures.push(row.slug || row.tenantId);
        }
      }
      if (failures.length > 0) {
        throw new Error(`Applied with failures: ${failures.join(", ")}`);
      }
      setStatus(`Applied matrix to ${tenants.data.length} tenant(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk apply failed");
    } finally {
      setBusy(false);
    }
  }, [rolePolicies]);

  if (loading) {
    return <p className="status-text text-sm">Loading tenant role matrix…</p>;
  }
  if (error && !rolePolicies) {
    return (
      <div className="panel stack-gap">
        <p className="text-sm text-red-400">{error}</p>
        <button className="cta cta-secondary" type="button" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="panel stack-gap">
      <div className="panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Role matrix</h2>
          <p className="status-text text-sm">
            Tenant: <strong>{tenantName || tenantId}</strong>{tenantSlug ? <> · <code>{tenantSlug}</code></> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="cta cta-secondary text-sm" type="button" disabled={busy} onClick={() => void applyToAllTenants()}>
            Apply to all tenants
          </button>
          <button className="cta text-sm" type="button" disabled={busy} onClick={() => void saveAll()}>
            {busy ? "Saving…" : "Save all"}
          </button>
        </div>
      </div>
      {status ? <p className="status-text text-sm text-[var(--xf-gain-green)]">{status}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {rolePolicies ? (
        <>
          <div className="crud-table-wrap">
            <table className="crud-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Path</th>
                  {ROLE_ORDER.map((role) => (
                    <th key={role}>{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routeRows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.label}</td>
                    <td>
                      <code className="font-mono text-xs">{entry.pathPattern}</code>
                    </td>
                    {ROLE_ORDER.map((role) => (
                      <td key={`${entry.id}-${role}`}>
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input
                            checked={routeEnabled(rolePolicies[role], entry.pathPattern)}
                            disabled={role === "global_admin" || busy}
                            type="checkbox"
                            onChange={(event) => setRouteEnabled(role, entry.pathPattern, event.target.checked)}
                          />
                          {routeEnabled(rolePolicies[role], entry.pathPattern) ? "allow" : "deny"}
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ROLE_ORDER.map((role) => (
              <div key={role} className="rounded-lg border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{role}</h3>
                  {role !== "global_admin" ? (
                    <button
                      className="text-xs font-semibold text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
                      disabled={busy}
                      type="button"
                      onClick={() => void saveRole(role)}
                    >
                      Save role
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[var(--xf-text-400)]">
                  Allowed routes: {rolePolicies[role].allowedRoutes.length}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="cta cta-secondary text-xs"
                    disabled={busy || role === "global_admin"}
                    type="button"
                    onClick={() => setAllForRole(role, true)}
                  >
                    Allow all
                  </button>
                  <button
                    className="cta cta-secondary text-xs"
                    disabled={busy || role === "global_admin"}
                    type="button"
                    onClick={() => setAllForRole(role, false)}
                  >
                    Deny all
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="status-text text-xs">
        Need route catalog context?{" "}
        <Link className="underline-offset-2 hover:underline" href={`/api/admin/platform/route-catalog/${encodeURIComponent(tenantId)}`}>
          Open tenant catalog API
        </Link>
      </p>
    </section>
  );
}
