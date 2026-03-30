"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { ATX_BILLING_PLAN_IDS, ATX_BILLING_PLANS, type AtxBillingPlanId } from "@/lib/atx-billing-plans";
import type { TenantBrandingPreferences } from "@/modules/identity/tenant-branding-preferences";
import {
    DEFAULT_TENANT_WORKSPACE_LIMITS,
    type TenantPlanWorkspaceOverrides,
    type TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";

type Props = {
  tenantId: string;
};

const FIELDS: { key: keyof TenantWorkspaceLimits; label: string; abbr: string; hint: string }[] = [
  {
    key: "userXoptionsLimit",
    label: "xoptions views / day (per user)",
    abbr: "xOpt/day",
    hint: "Signed-in xoptions deck + follow-up share this UTC daily bucket."
  },
  {
    key: "userChatLimit",
    label: "xChat prompts / day (per user)",
    abbr: "xChat/day",
    hint: "Capped with plan: effective = min(plan, tenant)."
  },
  {
    key: "tenantPortfolioLimit",
    label: "Portfolios per user",
    abbr: "Pf/user",
    hint: "Max portfolio rows per user in this tenant."
  },
  {
    key: "portfolioAccountLimit",
    label: "Accounts per portfolio",
    abbr: "Acct/pf",
    hint: "Max custodian accounts per portfolio."
  }
];

type PlanLimitDrafts = Record<AtxBillingPlanId, Partial<Record<keyof TenantWorkspaceLimits, string>>>;

function emptyPlanDrafts(): PlanLimitDrafts {
  return {
    basic: {},
    premium_monthly: {},
    premium_plus_yearly: {}
  };
}

function planLabel(id: AtxBillingPlanId): string {
  return ATX_BILLING_PLANS.find((p) => p.id === id)?.name ?? id;
}

function draftsFromPlanOverrides(po: TenantPlanWorkspaceOverrides | null | undefined): PlanLimitDrafts {
  const d = emptyPlanDrafts();
  if (!po) {
    return d;
  }
  for (const planId of ATX_BILLING_PLAN_IDS) {
    const row = po[planId];
    if (!row) {
      continue;
    }
    for (const f of FIELDS) {
      const v = row[f.key];
      if (typeof v === "number") {
        d[planId][f.key] = String(v);
      }
    }
  }
  return d;
}

function planOverridesFromDrafts(drafts: PlanLimitDrafts): TenantPlanWorkspaceOverrides {
  const out: TenantPlanWorkspaceOverrides = {};
  for (const planId of ATX_BILLING_PLAN_IDS) {
    const partial: Partial<TenantWorkspaceLimits> = {};
    for (const f of FIELDS) {
      const raw = drafts[planId]?.[f.key]?.trim() ?? "";
      if (raw === "") {
        continue;
      }
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1) {
        continue;
      }
      partial[f.key] = n;
    }
    if (Object.keys(partial).length > 0) {
      out[planId] = partial;
    }
  }
  return out;
}

function buildTenantPreferencesForSave(
  tenantPreferences: TenantBrandingPreferences,
  xchatDebugEnabled: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = { xchat_debug_enabled: xchatDebugEnabled };
  const xc = tenantPreferences.xchat_brandname?.trim();
  const xsb = tenantPreferences.xstrategybuilder_brandname?.trim();
  if (xc) {
    out.xchat_brandname = xc;
  }
  if (xsb) {
    out.xstrategybuilder_brandname = xsb;
  }
  return out;
}

export function TenantWorkspaceLimitsPanel({ tenantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [values, setValues] = useState<TenantWorkspaceLimits | null>(null);
  const [tenantPreferences, setTenantPreferences] = useState<TenantBrandingPreferences>({
    xchat_brandname: "",
    xstrategybuilder_brandname: ""
  });
  const [tenantPreferencesRaw, setTenantPreferencesRaw] = useState<Record<string, unknown>>({});
  const [xchatDebugEnabled, setXchatDebugEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [planDrafts, setPlanDrafts] = useState<PlanLimitDrafts>(() => emptyPlanDrafts());

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/workspace-limits`, {
        credentials: "include"
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: {
          workspaceLimits?: TenantWorkspaceLimits;
          planOverrides?: TenantPlanWorkspaceOverrides;
          slug?: string;
          tenantPreferences?: TenantBrandingPreferences;
          tenantPreferencesRaw?: Record<string, unknown>;
        };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      if (!payload.data?.workspaceLimits) {
        throw new Error("Missing limits payload");
      }
      setValues(payload.data.workspaceLimits);
      setPlanDrafts(draftsFromPlanOverrides(payload.data.planOverrides));
      setSlug(payload.data.slug ?? "");
      setTenantPreferences({
        xchat_brandname: payload.data.tenantPreferences?.xchat_brandname ?? "",
        xstrategybuilder_brandname: payload.data.tenantPreferences?.xstrategybuilder_brandname ?? ""
      });
      const raw = (payload.data.tenantPreferencesRaw ??
        payload.data.tenantPreferences ??
        {}) as Record<string, unknown>;
      setTenantPreferencesRaw(raw);
      setXchatDebugEnabled(raw.xchat_debug_enabled === true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
      setValues(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function onResetDraftToDefaults() {
    setValues({ ...DEFAULT_TENANT_WORKSPACE_LIMITS });
    setPlanDrafts(emptyPlanDrafts());
    setStatus("Draft reset to product defaults (save to apply).");
    window.setTimeout(() => setStatus(""), 5000);
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values) {
      return;
    }
    setSaving(true);
    setStatus("");
    setErr("");
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/workspace-limits`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceLimits: values,
          planOverrides: planOverridesFromDrafts(planDrafts),
          tenantPreferences: buildTenantPreferencesForSave(tenantPreferences, xchatDebugEnabled)
        })
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: {
          workspaceLimits?: TenantWorkspaceLimits;
          planOverrides?: TenantPlanWorkspaceOverrides;
          tenantPreferences?: TenantBrandingPreferences;
          tenantPreferencesRaw?: Record<string, unknown>;
        };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      if (payload.data?.workspaceLimits) {
        setValues(payload.data.workspaceLimits);
      }
      if (payload.data?.planOverrides !== undefined) {
        setPlanDrafts(draftsFromPlanOverrides(payload.data.planOverrides));
      }
      if (payload.data?.tenantPreferences) {
        setTenantPreferences({
          xchat_brandname: payload.data.tenantPreferences.xchat_brandname ?? "",
          xstrategybuilder_brandname: payload.data.tenantPreferences.xstrategybuilder_brandname ?? ""
        });
      }
      if (payload.data?.tenantPreferencesRaw) {
        setTenantPreferencesRaw(payload.data.tenantPreferencesRaw);
        setXchatDebugEnabled(payload.data.tenantPreferencesRaw.xchat_debug_enabled === true);
      }
      setStatus("Saved.");
      window.setTimeout(() => setStatus(""), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="admin-muted">Loading workspace limits…</p>;
  }
  if (!values) {
    return <p className="status-text status-error">{err || "Could not load limits."}</p>;
  }

  return (
    <form className="xf-widget section-card admin-tenant-pref-form" onSubmit={(e) => void onSave(e)}>
      <div className="crud-table-wrap admin-tenant-pref-table-wrap">
        <table className="crud-table admin-tenant-pref-crud-table">
          <thead>
            <tr>
              <th scope="col">Tenant</th>
              {FIELDS.map((f) => (
                <th key={f.key} scope="col" title={f.hint}>
                  <span className="admin-tenant-pref-crud-table__abbr">{f.abbr}</span>
                  <span className="admin-tenant-pref-crud-table__full">{f.label}</span>
                </th>
              ))}
              <th scope="col" title="Opt-in [xchat/debug] logs for this tenant">
                xChat debug
              </th>
              <th scope="col">xchat brand</th>
              <th scope="col">xSB brand</th>
              <th scope="col" className="admin-tenant-pref-crud-table__actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code className="font-mono text-xs">{slug || tenantId}</code>
              </td>
              {FIELDS.map((f) => (
                <td key={f.key}>
                  <input
                    aria-label={f.label}
                    className="crud-input text-sm"
                    min={1}
                    max={1_000_000}
                    required
                    title={f.hint}
                    type="number"
                    value={values[f.key]}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setValues((prev) =>
                        prev ? { ...prev, [f.key]: Number.isFinite(n) ? n : prev[f.key] } : prev
                      );
                    }}
                  />
                </td>
              ))}
              <td>
                <input
                  aria-label="Enable xChat debug logs for this tenant"
                  checked={xchatDebugEnabled}
                  type="checkbox"
                  onChange={(e) => setXchatDebugEnabled(e.target.checked)}
                />
              </td>
              <td>
                <input
                  className="crud-input text-sm"
                  disabled={Boolean(tenantPreferences.xchat_brandname?.trim())}
                  placeholder="Once only"
                  title="Set once in DB"
                  value={tenantPreferences.xchat_brandname ?? ""}
                  onChange={(e) =>
                    setTenantPreferences((prev) => ({ ...prev, xchat_brandname: e.target.value }))
                  }
                />
              </td>
              <td>
                <input
                  className="crud-input text-sm"
                  disabled={Boolean(tenantPreferences.xstrategybuilder_brandname?.trim())}
                  placeholder="Once only"
                  title="Set once in DB"
                  value={tenantPreferences.xstrategybuilder_brandname ?? ""}
                  onChange={(e) =>
                    setTenantPreferences((prev) => ({
                      ...prev,
                      xstrategybuilder_brandname: e.target.value
                    }))
                  }
                />
              </td>
              <td className="admin-tenant-pref-crud-table__actions">
                <div className="admin-tenant-pref-action-stack">
                  <button
                    className="cta cta-secondary"
                    disabled={loading}
                    type="button"
                    onClick={() => void load()}
                  >
                    <RefreshIcon className="crud-icon" aria-hidden />
                    Reload
                  </button>
                  <button className="cta cta-secondary" type="button" onClick={onResetDraftToDefaults}>
                    Reset draft
                  </button>
                  <button className="cta cta-primary" disabled={saving} type="submit">
                    <SaveIcon className="crud-icon" aria-hidden />
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-white">Per-billing-plan overrides</h3>
        <p className="admin-muted text-xs max-w-3xl">
          Maps to subscription tier (Basic → free, Premium → pro, Premium+ → enterprise). Leave cells empty to
          inherit the tenant defaults in the row above. Saving writes all three tiers; clear every cell and save
          to remove overrides.
        </p>
        <div className="crud-table-wrap admin-tenant-pref-table-wrap">
          <table className="crud-table admin-tenant-pref-crud-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                {FIELDS.map((f) => (
                  <th key={f.key} scope="col" title={f.hint}>
                    <span className="admin-tenant-pref-crud-table__abbr">{f.abbr}</span>
                    <span className="admin-tenant-pref-crud-table__full">{f.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATX_BILLING_PLAN_IDS.map((planId) => (
                <tr key={planId}>
                  <td>
                    <span className="text-sm font-medium text-white">{planLabel(planId)}</span>
                    <div className="font-mono text-[10px] text-slate-500">{planId}</div>
                  </td>
                  {FIELDS.map((f) => (
                    <td key={f.key}>
                      <input
                        aria-label={`${planLabel(planId)} ${f.label}`}
                        className="crud-input text-sm"
                        min={1}
                        max={1_000_000}
                        placeholder="inherit"
                        title={f.hint}
                        type="number"
                        value={planDrafts[planId]?.[f.key] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPlanDrafts((prev) => ({
                            ...prev,
                            [planId]: { ...prev[planId], [f.key]: v }
                          }));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="admin-tenant-pref-meta">
        <summary>Field hints &amp; raw tenant_preferences</summary>
        <ul className="admin-muted admin-tenant-pref-hint-list">
          {FIELDS.map((f) => (
            <li key={f.key}>
              <strong>{f.label}:</strong> {f.hint}
            </li>
          ))}
        </ul>
        <div className="crud-table-wrap">
          <table className="crud-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value (read-only)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tenantPreferencesRaw).length === 0 ? (
                <tr>
                  <td colSpan={2} className="admin-muted">
                    No tenant preferences stored.
                  </td>
                </tr>
              ) : (
                Object.entries(tenantPreferencesRaw).map(([key, value]) => (
                  <tr key={key}>
                    <td>
                      <code className="font-mono text-xs">{key}</code>
                    </td>
                    <td>
                      <code className="font-mono text-xs" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {typeof value === "string" ? value : JSON.stringify(value)}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </details>

      {err ? <p className="status-text status-error">{err}</p> : null}
      {status ? <p className="status-text">{status}</p> : null}
    </form>
  );
}
