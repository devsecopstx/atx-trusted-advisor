"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { TenantWorkspaceLimitsPanel } from "@/app/admin/tenant-preferences/ui/tenant-workspace-limits-panel";
import { RefreshIcon } from "@/app/admin/ui/crud-icons";

type Props = {
  /** Server-resolved fallback when query param is missing/invalid. */
  defaultTenantId: string;
};

type TenantRegisterRow = {
  tenantId: string;
  slug: string;
  name: string;
  isPlatformDefault: boolean;
};

type TenantRegisterResponse = {
  data: TenantRegisterRow[];
};

export function TenantWorkspaceLimitsPageClient({ defaultTenantId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tenants, setTenants] = useState<TenantRegisterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, startTransition] = useTransition();

  const queryTenant = searchParams?.get("tenant")?.trim() ?? "";

  const selectedTenantId = useMemo(() => {
    const candidate = queryTenant || defaultTenantId;
    if (!candidate) return "";
    // Basic hex/id sanity (ObjectId hex or any non-empty string accepted here — API will 404 otherwise)
    return candidate;
  }, [queryTenant, defaultTenantId]);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tenants", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load tenants (${res.status})`);
      }
      const json = (await res.json()) as TenantRegisterResponse | { data?: unknown };
      const rows = Array.isArray((json as TenantRegisterResponse).data)
        ? ((json as TenantRegisterResponse).data as TenantRegisterRow[])
        : [];
      // Lightweight projection — ensure expected fields exist
      const simple = rows.map((t) => ({
        tenantId: t.tenantId,
        slug: t.slug ?? "",
        name: t.name ?? t.slug ?? t.tenantId,
        isPlatformDefault: Boolean(t.isPlatformDefault)
      }));
      setTenants(simple);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenants");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const updateQueryTenant = useCallback(
    (tenantId: string) => {
      const sp = new URLSearchParams(searchParams?.toString());
      if (tenantId) {
        sp.set("tenant", tenantId);
      } else {
        sp.delete("tenant");
      }
      // Shallow replace to avoid a full navigation; keeps admin shell state stable
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const onChangeTenant = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateQueryTenant(e.target.value);
    },
    [updateQueryTenant]
  );

  const onReload = useCallback(() => {
    startTransition(() => {
      void loadTenants();
    });
  }, [loadTenants]);

  const effectiveTenantId = selectedTenantId || defaultTenantId;

  return (
    <div className="admin-tenant-workspace-limits-page">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="tenant-select" className="block text-sm font-semibold text-[var(--xf-muted-fg)]">
            Tenant
          </label>
          <div className="flex items-center gap-2">
            <select
              id="tenant-select"
              className="min-w-[16rem] rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 text-sm"
              value={effectiveTenantId}
              onChange={onChangeTenant}
              disabled={loading || Boolean(tenants && tenants.length === 0)}
            >
              {loading && <option value="">Loading tenants…</option>}
              {!loading && tenants && tenants.length === 0 && <option value="">No tenants found</option>}
              {!loading && tenants && tenants.length > 0 && (
                tenants
                  .slice()
                  .sort((a, b) => {
                    // Platform default first, then by name/slug
                    const ap = a.isPlatformDefault ? 0 : 1;
                    const bp = b.isPlatformDefault ? 0 : 1;
                    if (ap !== bp) return ap - bp;
                    const an = (a.name || a.slug || a.tenantId).toLowerCase();
                    const bn = (b.name || b.slug || b.tenantId).toLowerCase();
                    return an.localeCompare(bn);
                  })
                  .map((t) => {
                    const label = t.name || t.slug || t.tenantId;
                    return (
                      <option key={t.tenantId} value={t.tenantId}>
                        {label} {t.isPlatformDefault ? "• default" : ""}
                      </option>
                    );
                  })
              )}
            </select>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-[var(--xf-muted-border)] px-2 py-1 text-xs hover:bg-[var(--xf-surface-2)]"
              onClick={onReload}
              disabled={loading}
              title="Reload tenants"
            >
              <RefreshIcon /> Reload
            </button>
          </div>
          {error ? <p className="mt-1 text-xs text-[var(--xf-loss-red)]">{error}</p> : null}
        </div>
        <div className="flex-1" />
      </div>

      <div className="mt-6">
        {effectiveTenantId ? (
          <TenantWorkspaceLimitsPanel tenantId={effectiveTenantId} />
        ) : (
          <div className="rounded border border-[var(--xf-muted-border)] p-4 text-sm">
            Select a tenant to configure workspace limits.
          </div>
        )}
      </div>

      {isRefreshing ? (
        <p className="mt-2 text-xs text-[var(--xf-muted-fg)]">Refreshing…</p>
      ) : null}
    </div>
  );
}
