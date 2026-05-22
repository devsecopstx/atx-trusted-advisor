"use client";

import { useCallback, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";

type TenantAdminRow = {
  userId: string;
  email: string;
  displayName: string;
  tenantRole: "tenant_admin" | "member";
  isDefaultSessionTenant: boolean;
  isTenantAdmin: boolean;
};

type UserOption = {
  userId: string;
  email: string;
  label: string;
};

type MembershipsPayload = {
  data: {
    hasTenantAdmin: boolean;
    tenantAdmins: TenantAdminRow[];
    memberships: TenantAdminRow[];
  };
};

type UsersPayload = {
  data: Array<{
    _id?: string;
    email: string;
    xAccount?: { displayName?: string; username?: string };
  }>;
};

type TenantAdminAssignPanelProps = {
  tenantId: string;
  onHasTenantAdminChange?: (hasTenantAdmin: boolean) => void;
};

export function TenantAdminAssignPanel({ tenantId, onHasTenantAdminChange }: TenantAdminAssignPanelProps) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasTenantAdmin, setHasTenantAdmin] = useState(false);
  const [tenantAdmins, setTenantAdmins] = useState<TenantAdminRow[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const notify = useCallback(
    (next: boolean) => {
      setHasTenantAdmin(next);
      onHasTenantAdminChange?.(next);
    },
    [onHasTenantAdminChange]
  );

  const load = useCallback(async () => {
    if (!tenantId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [membershipsRes, usersRes] = await Promise.all([
        fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/memberships`),
        fetch("/api/admin/users?limit=500")
      ]);
      const membershipsPayload = await parseJson<MembershipsPayload>(membershipsRes);
      notify(membershipsPayload.data.hasTenantAdmin);
      setTenantAdmins(membershipsPayload.data.tenantAdmins);

      if (usersRes.ok) {
        const usersPayload = (await usersRes.json()) as UsersPayload;
        const options = (usersPayload.data ?? [])
          .filter((u) => u._id && u.email)
          .map((u) => {
            const display =
              u.xAccount?.displayName?.trim() ||
              u.xAccount?.username?.trim() ||
              u.email;
            return {
              userId: u._id!,
              email: u.email,
              label: display !== u.email ? `${display} · ${u.email}` : u.email
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label));
        setUserOptions(options);
        setSelectedUserId((prev) => prev || options[0]?.userId || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenant admins.");
    } finally {
      setLoading(false);
    }
  }, [notify, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignTenantAdmin() {
    if (!selectedUserId) {
      setError("Select a user to assign as tenant admin.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, tenantRole: "tenant_admin" })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Assign failed.");
      }
      setStatus("Tenant admin assigned.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="status-text text-sm">Loading tenant admin…</p>;
  }

  return (
    <section className="panel stack-gap border border-[color-mix(in_srgb,var(--xf-gain-green)_25%,transparent)]">
      <div>
        <h3 className="text-base font-semibold text-[var(--xf-text-100)]">Tenant admin (required)</h3>
        <p className="status-text text-sm">
          Each tenant must have at least one <code className="font-mono text-xs">tenant_admin</code>. Assign an
          existing user before saving tenant settings.
        </p>
      </div>

      {!hasTenantAdmin ? (
        <p className="text-sm text-[var(--xf-lightning-yellow)]" role="status">
          No tenant admin assigned yet — save is blocked until you assign one.
        </p>
      ) : null}

      {tenantAdmins.length > 0 ? (
        <ul className="m-0 list-disc pl-5 text-sm text-[var(--xf-text-200)]">
          {tenantAdmins.map((row) => (
            <li key={row.userId}>
              {row.displayName} · <span className="font-mono text-xs">{row.email}</span>
              {row.isTenantAdmin ? (
                <span className="ml-2 text-xs text-[var(--xf-gain-green)]">isTenantAdmin</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="status-text text-sm">No tenant admins listed.</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <span className="text-sm font-medium">Existing user</span>
          <select
            className="rounded border border-[color-mix(in_srgb,var(--xf-text-100)_18%,transparent)] bg-[var(--xf-surface-800)] px-3 py-2 text-sm"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">Select user…</option>
            {userOptions.map((opt) => (
              <option key={opt.userId} value={opt.userId}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button className="cta cta-secondary text-sm" disabled={busy || !selectedUserId} type="button" onClick={() => void assignTenantAdmin()}>
          {busy ? "Assigning…" : "Assign tenant admin"}
        </button>
      </div>

      {status ? <p className="status-text text-sm text-[var(--xf-gain-green)]">{status}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
