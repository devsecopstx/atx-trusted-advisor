"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { AmbientExperiencePanel } from "@/app/admin/tenant-preferences/ui/ambient-experience-panel";
import { FeatureFlagsPanel } from "@/app/admin/tenant-preferences/ui/feature-flags-panel";
import { OptionsStrategyEnginePanel } from "@/app/admin/tenant-preferences/ui/options-strategy-engine-panel";
import { TenantWorkspaceLimitsPanel } from "@/app/admin/tenant-preferences/ui/tenant-workspace-limits-panel";
import { XchatDefaultPersonaPanel } from "@/app/admin/tenant-preferences/ui/xchat-default-persona-panel";
import { RefreshIcon } from "@/app/admin/ui/crud-icons";

type Props = {
  sessionTenantId: string;
  initialTab: TabId;
  initialTenantId: string;
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

const TABS = [
  { id: "workspace-limits", label: "Workspace limits" },
  { id: "strategy-engine", label: "Strategy engine" },
  { id: "ambient", label: "Ambient experience" },
  { id: "persona", label: "Default persona" },
  { id: "feature-flags", label: "Feature flags" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function UnifiedTenantPreferencesClient({
  sessionTenantId,
  initialTab,
  initialTenantId
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [tenants, setTenants] = useState<TenantRegisterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [selectedTenantIdState, setSelectedTenantIdState] = useState(initialTenantId);

  useEffect(() => {
    setActiveTab(initialTab);
    setSelectedTenantIdState(initialTenantId);
  }, [initialTab, initialTenantId]);

  const pushPrefsUrl = useCallback(
    (tab: TabId, tenantId: string) => {
      const sp = new URLSearchParams();
      sp.set("tab", tab);
      if (tenantId && tenantId !== sessionTenantId) {
        sp.set("tenant", tenantId);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, sessionTenantId]
  );

  const selectedTenantId = useMemo(() => {
    return selectedTenantIdState || sessionTenantId;
  }, [selectedTenantIdState, sessionTenantId]);

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

  const onChangeTenant = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      setSelectedTenantIdState(v);
      pushPrefsUrl(activeTab, v);
    },
    [activeTab, pushPrefsUrl]
  );

  const onSelectTab = useCallback(
    (id: TabId) => {
      setActiveTab(id);
      pushPrefsUrl(id, selectedTenantIdState || sessionTenantId);
    },
    [pushPrefsUrl, selectedTenantIdState, sessionTenantId]
  );

  const onReload = useCallback(() => {
    startTransition(() => {
      void loadTenants();
    });
  }, [loadTenants]);

  return (
    <div className="admin-tenant-workspace-limits-page">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="tenant-select" className="block text-sm font-semibold text-[var(--xf-text-400)]">
            Tenant
          </label>
          <div className="flex items-center gap-2">
            <select
              id="tenant-select"
              className="min-w-[16rem] rounded border border-[var(--xf-muted-border)] bg-[var(--xf-surface)] p-2 text-sm text-[var(--xf-text-100)]"
              value={selectedTenantId}
              onChange={onChangeTenant}
              disabled={loading || Boolean(tenants && tenants.length === 0)}
            >
              {loading && <option value="">Loading tenants…</option>}
              {!loading && tenants && tenants.length === 0 && <option value="">No tenants found</option>}
              {!loading &&
                tenants &&
                tenants.length > 0 &&
                tenants
                  .slice()
                  .sort((a, b) => {
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
                  })}
            </select>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-[var(--xf-muted-border)] px-2 py-1 text-xs text-[var(--xf-text-200)] hover:bg-[var(--xf-surface-2)]"
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

      <nav className="mt-6 flex gap-1 border-b border-[var(--xf-muted-border)]" role="tablist" aria-label="Preference sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            className={
              activeTab === tab.id
                ? "-mb-px rounded-t-md border border-[var(--xf-border-subtle)] border-b-transparent bg-[var(--xf-bg-800)] px-4 py-2 text-sm font-semibold text-[var(--xf-gain-green)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--xf-gain-green)]"
                : "-mb-px rounded-t-md border border-transparent bg-[color-mix(in_srgb,var(--xf-surface-800)_78%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--xf-text-200)] transition-colors hover:border-[var(--xf-border-subtle)] hover:text-[var(--xf-text-100)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--xf-gain-green)]"
            }
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {!selectedTenantId ? (
          <div className="rounded border border-[var(--xf-muted-border)] p-4 text-sm">
            Select a tenant to configure preferences.
          </div>
        ) : (
          <>
            {activeTab === "workspace-limits" && (
              <TenantWorkspaceLimitsPanel tenantId={selectedTenantId} />
            )}
            {activeTab === "strategy-engine" && (
              <OptionsStrategyEnginePanel tenantId={selectedTenantId} />
            )}
            {activeTab === "ambient" && (
              <AmbientExperiencePanel tenantId={selectedTenantId} />
            )}
            {activeTab === "persona" && <XchatDefaultPersonaPanel />}
            {activeTab === "feature-flags" && (
              <FeatureFlagsPanel tenantId={selectedTenantId} />
            )}
          </>
        )}
      </div>

      {isRefreshing ? (
        <p className="mt-2 text-xs text-[var(--xf-text-400)]">Refreshing…</p>
      ) : null}
    </div>
  );
}
