"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { ATX_BILLING_PLAN_IDS, ATX_BILLING_PLANS, type AtxBillingPlanId } from "@/lib/atx-billing-plans";
import type { XfUiThemePreference } from "@/lib/xf-ui-theme";
import type { TenantBrandingPreferences } from "@/modules/identity/tenant-branding-preferences";
import {
    DEFAULT_TENANT_PLAN_PRICE,
    DEFAULT_TENANT_WORKSPACE_LIMITS,
    type TenantPlanWorkspaceOverrides,
    type TenantPlanWorkspaceRow,
    type TenantWorkspaceLimits
} from "@/modules/identity/tenant-workspace-limits";

type Props = {
  tenantId: string;
};

type PlanQuotaFieldKey =
  | "userXoptionsLimit"
  | "userChatLimit"
  | "userChatHourlyLimit"
  | "tenantPortfolioLimit"
  | "portfolioAccountLimit";

const QUOTA_FIELDS: { key: PlanQuotaFieldKey; label: string; abbr: string; hint: string }[] = [
  {
    key: "userXoptionsLimit",
    label: "xoptions views / hr (per user)",
    abbr: "xOpt/hr",
    hint: "Signed-in xoptions deck + follow-up; billing copy uses per-hour caps (see tenant-workspace-limits enforcement notes)."
  },
  {
    key: "userChatLimit",
    label: "xChat prompts / day (UTC, per user)",
    abbr: "xChat/d",
    hint: "Tenant row: hard cap per UTC day for every app user on this tenant in POST /api/xchat/ask. Plan-table cell: not used for ask (informational / legacy)."
  },
  {
    key: "userChatHourlyLimit",
    label: "xChat prompts / hr (UTC, per user)",
    abbr: "xChat/hr",
    hint: "Tenant row: optional UTC hour cap for ask; 0 = off. Plan-table cell: not used for ask."
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

const MAX_USERS_PER_TENANT_FIELD = {
  key: "maxUsersPerTenant" as const,
  label: "Max users per tenant",
  abbr: "Users/tenant",
  hint: "Maximum distinct users allowed a membership on this tenant (enforced on OAuth, access approval, and admin user create)."
};

/** Base tenant row includes per-tenant user cap; billing-plan override table uses QUOTA_FIELDS only. */
const TENANT_BASE_QUOTA_FIELDS = [...QUOTA_FIELDS, MAX_USERS_PER_TENANT_FIELD];

const PREF_FIELDS: (
  | {
      key: "changePersonaEnabled";
      label: string;
      abbr: string;
      hint: string;
      kind: "checkbox";
    }
  | { key: "chatHistoryMax"; label: string; abbr: string; hint: string; kind: "number" }
)[] = [
  {
    key: "changePersonaEnabled",
    label: "Change persona",
    abbr: "Chg persona",
    kind: "checkbox",
    hint: "When off, app users cannot switch xChat persona (picker disabled). global_admin is unaffected."
  },
  {
    key: "chatHistoryMax",
    label: "Chat history max (turns)",
    abbr: "Hist max",
    kind: "number",
    hint: "UI + history API: max recent turns shown (default 10). Does not cap POST /api/xchat/ask per day — use xChat/d for daily prompt limits."
  }
];

type PlanLimitDrafts = Record<
  AtxBillingPlanId,
  Partial<
    Record<PlanQuotaFieldKey | "chatHistoryMax" | "changePersonaEnabled" | "price" | "stripeProductId" | "stripePriceId", string>
  >
>;

function emptyPlanDrafts(): PlanLimitDrafts {
  return {
    basic: {},
    premium_monthly: {},
    premium_plus_monthly: {}
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
      d[planId] = { price: String(DEFAULT_TENANT_PLAN_PRICE) };
      continue;
    }
    for (const f of QUOTA_FIELDS) {
      const v = row[f.key];
      if (typeof v === "number") {
        d[planId][f.key] = String(v);
      }
    }
    if (typeof row.changePersonaEnabled === "boolean") {
      d[planId].changePersonaEnabled = row.changePersonaEnabled ? "true" : "false";
    }
    if (typeof row.chatHistoryMax === "number") {
      d[planId].chatHistoryMax = String(row.chatHistoryMax);
    }
    const listPrice = row.price;
    d[planId].price = listPrice != null ? String(listPrice) : String(DEFAULT_TENANT_PLAN_PRICE);
    if (typeof row.stripeProductId === "string" && row.stripeProductId.trim() !== "") {
      d[planId].stripeProductId = row.stripeProductId.trim();
    }
    if (typeof row.stripePriceId === "string" && row.stripePriceId.trim() !== "") {
      d[planId].stripePriceId = row.stripePriceId.trim();
    }
  }
  return d;
}

function planOverridesFromDrafts(drafts: PlanLimitDrafts): TenantPlanWorkspaceOverrides {
  const out: TenantPlanWorkspaceOverrides = {};
  for (const planId of ATX_BILLING_PLAN_IDS) {
    const partial: TenantPlanWorkspaceRow = {};
    for (const f of QUOTA_FIELDS) {
      const raw = drafts[planId]?.[f.key]?.trim() ?? "";
      if (raw === "") {
        continue;
      }
      const n = Number.parseInt(raw, 10);
      if (f.key === "userChatHourlyLimit") {
        if (Number.isFinite(n) && n >= 0) {
          partial.userChatHourlyLimit = n;
        }
        continue;
      }
      if (!Number.isFinite(n) || n < 1) {
        continue;
      }
      partial[f.key] = n;
    }
    const rawCp = drafts[planId]?.changePersonaEnabled?.trim() ?? "";
    if (rawCp === "true") {
      partial.changePersonaEnabled = true;
    } else if (rawCp === "false") {
      partial.changePersonaEnabled = false;
    }
    const rawHist = drafts[planId]?.chatHistoryMax?.trim() ?? "";
    if (rawHist !== "") {
      const n = Number.parseInt(rawHist, 10);
      if (Number.isFinite(n) && n >= 1) {
        partial.chatHistoryMax = n;
      }
    }
    const rawPrice = drafts[planId]?.price?.trim() ?? "";
    const priceNum =
      rawPrice === ""
        ? DEFAULT_TENANT_PLAN_PRICE
        : Number.parseInt(rawPrice, 10);
    partial.price =
      Number.isFinite(priceNum) && priceNum >= 1 ? priceNum : DEFAULT_TENANT_PLAN_PRICE;
    const rawStripeProd = drafts[planId]?.stripeProductId?.trim() ?? "";
    if (rawStripeProd !== "" && /^prod_[a-zA-Z0-9_]+$/.test(rawStripeProd)) {
      partial.stripeProductId = rawStripeProd;
    }
    const rawStripePrice = drafts[planId]?.stripePriceId?.trim() ?? "";
    if (rawStripePrice !== "" && /^price_[a-zA-Z0-9_]+$/.test(rawStripePrice)) {
      partial.stripePriceId = rawStripePrice;
    }
    out[planId] = partial;
  }
  return out;
}

function buildTenantPreferencesForSave(
  tenantPreferences: TenantBrandingPreferences,
  xchatDebugEnabled: boolean,
  xfUiTheme: XfUiThemePreference | "inherit"
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
  out.xf_ui_theme = xfUiTheme === "inherit" ? null : xfUiTheme;
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
  const [xfUiTheme, setXfUiTheme] = useState<XfUiThemePreference | "inherit">("inherit");
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
      setValues({
        ...payload.data.workspaceLimits,
        userChatHourlyLimit: payload.data.workspaceLimits.userChatHourlyLimit ?? 0
      });
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
      const th = raw.xf_ui_theme;
      if (th === "light" || th === "dark" || th === "system") {
        setXfUiTheme(th);
      } else {
        setXfUiTheme("inherit");
      }
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
    setValues({ ...DEFAULT_TENANT_WORKSPACE_LIMITS, userChatHourlyLimit: 0 });
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
          tenantPreferences: buildTenantPreferencesForSave(tenantPreferences, xchatDebugEnabled, xfUiTheme)
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
        setValues({
          ...payload.data.workspaceLimits,
          userChatHourlyLimit: payload.data.workspaceLimits.userChatHourlyLimit ?? 0
        });
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
        const th = payload.data.tenantPreferencesRaw.xf_ui_theme;
        if (th === "light" || th === "dark" || th === "system") {
          setXfUiTheme(th);
        } else {
          setXfUiTheme("inherit");
        }
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

  const hourly = values.userChatHourlyLimit ?? 0;

  return (
    <form className="xf-widget section-card admin-tenant-pref-form" onSubmit={(e) => void onSave(e)}>
      <div
        className="mb-4 rounded-lg border border-[var(--xf-border-subtle)] bg-[var(--xf-surface-800)]/40 p-4"
        role="region"
        aria-label="xChat prompt caps for this tenant"
      >
        <h2 className="text-sm font-semibold text-[var(--xf-text-100)]">xChat prompt caps (tenant row)</h2>
        <p className="mt-1 text-xs text-[var(--xf-text-400)]">
          These numbers are enforced for <strong className="text-[var(--xf-text-200)]">all</strong> signed-in app users
          on this tenant (UTC). Per-billing-plan <span className="font-mono">xChat/d</span> and{" "}
          <span className="font-mono">xChat/hr</span> cells below do <strong className="text-[var(--xf-text-200)]">not</strong>{" "}
          change ask limits. <strong className="text-[var(--xf-text-200)]">Hist max</strong> is UI/history depth only,
          not this cap.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--xf-text-400)]">Daily limit</dt>
            <dd className="font-medium text-[var(--xf-text-100)]">{values.userChatLimit} prompts / UTC day</dd>
          </div>
          <div>
            <dt className="text-[var(--xf-text-400)]">Hourly limit</dt>
            <dd className="font-medium text-[var(--xf-text-100)]">
              {hourly > 0 ? `${hourly} prompts / UTC hour` : "Off (0 — only daily cap + per-minute burst rules apply)"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="crud-table-wrap admin-tenant-pref-table-wrap">
        <table className="crud-table admin-tenant-pref-crud-table">
          <thead>
            <tr>
              <th scope="col">Tenant</th>
              {TENANT_BASE_QUOTA_FIELDS.map((f) => (
                <th key={f.key} scope="col" title={f.hint}>
                  <span className="admin-tenant-pref-crud-table__abbr">{f.abbr}</span>
                  <span className="admin-tenant-pref-crud-table__full">{f.label}</span>
                </th>
              ))}
              {PREF_FIELDS.map((f) => (
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
              {TENANT_BASE_QUOTA_FIELDS.map((f) => {
                const isHourly = f.key === "userChatHourlyLimit";
                return (
                  <td key={f.key}>
                    <input
                      aria-label={f.label}
                      className="crud-input text-sm"
                      min={isHourly ? 0 : 1}
                      max={1_000_000}
                      required={!isHourly}
                      title={f.hint}
                      type="number"
                      value={isHourly ? (values.userChatHourlyLimit ?? 0) : values[f.key]}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        setValues((prev) => {
                          if (!prev) {
                            return prev;
                          }
                          if (isHourly) {
                            return {
                              ...prev,
                              userChatHourlyLimit: Number.isFinite(n) && n >= 0 ? n : 0
                            };
                          }
                          return { ...prev, [f.key]: Number.isFinite(n) ? n : prev[f.key] };
                        });
                      }}
                    />
                  </td>
                );
              })}
              {PREF_FIELDS.map((f) =>
                f.kind === "checkbox" ? (
                  <td key={f.key}>
                    <input
                      aria-label={f.label}
                      checked={values[f.key]}
                      title={f.hint}
                      type="checkbox"
                      onChange={(e) => {
                        setValues((prev) => (prev ? { ...prev, [f.key]: e.target.checked } : prev));
                      }}
                    />
                  </td>
                ) : (
                  <td key={f.key}>
                    <input
                      aria-label={f.label}
                      className="crud-input text-sm"
                      min={1}
                      max={1_000_000}
                      required
                      title={f.hint}
                      type="number"
                      value={values.chatHistoryMax}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        setValues((prev) =>
                          prev
                            ? {
                                ...prev,
                                chatHistoryMax: Number.isFinite(n) ? n : prev.chatHistoryMax
                              }
                            : prev
                        );
                      }}
                    />
                  </td>
                )
              )}
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-300" htmlFor="tenant-xf-ui-theme">
          Default shell theme (first visit before user picks in UI)
        </label>
        <select
          className="crud-input text-sm"
          id="tenant-xf-ui-theme"
          value={xfUiTheme}
          onChange={(e) => setXfUiTheme(e.target.value as XfUiThemePreference | "inherit")}
        >
          <option value="inherit">No tenant default</option>
          <option value="dark">Dark (deep)</option>
          <option value="light">Light (soft)</option>
          <option value="system">System</option>
        </select>
      </div>

      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-white">Per-billing-plan overrides</h3>
        <p className="admin-muted text-xs max-w-3xl">
          Overrides below apply to <strong className="text-slate-200">portfolio / xOptions / persona / history</strong>{" "}
          quotas and Stripe list price — <strong className="text-slate-200">not</strong> xChat daily/hourly ask caps (those
          use the tenant row only). Keys: <code className="font-mono text-[0.7rem]">basic</code>,{" "}
          <code className="font-mono text-[0.7rem]">premium_monthly</code>,{" "}
          <code className="font-mono text-[0.7rem]">premium_plus_monthly</code> (aligned with{" "}
          <code className="font-mono text-[0.7rem]">core_users.subscriptionPlan</code>). Empty limit cells inherit the
          tenant row above for <em>those</em> fields. List price (USD) defaults to {DEFAULT_TENANT_PLAN_PRICE}{" "}
          per plan when unset. Optional Stripe <strong>prod_…</strong> / <strong>price_…</strong> ids override env{" "}
          <code className="font-mono text-[0.65rem]">STRIPE_PRICE_*</code> for Checkout for this tenant; leave blank to
          use platform env. Saving persists all three tiers.
        </p>
        <div className="crud-table-wrap admin-tenant-pref-table-wrap">
          <table className="crud-table admin-tenant-pref-crud-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col" title="Admin list price in USD (whole dollars); not Stripe">
                  <span className="admin-tenant-pref-crud-table__abbr">$</span>
                  <span className="admin-tenant-pref-crud-table__full">Price (USD)</span>
                </th>
                <th scope="col" title="Stripe Product id (optional; reference)">
                  <span className="admin-tenant-pref-crud-table__abbr">prod</span>
                  <span className="admin-tenant-pref-crud-table__full">Stripe product</span>
                </th>
                <th scope="col" title="Stripe Price id — overrides STRIPE_PRICE_* for Checkout when set">
                  <span className="admin-tenant-pref-crud-table__abbr">price</span>
                  <span className="admin-tenant-pref-crud-table__full">Stripe price</span>
                </th>
                {QUOTA_FIELDS.map((f) => (
                  <th key={f.key} scope="col" title={f.hint}>
                    <span className="admin-tenant-pref-crud-table__abbr">{f.abbr}</span>
                    <span className="admin-tenant-pref-crud-table__full">{f.label}</span>
                  </th>
                ))}
                {PREF_FIELDS.map((f) => (
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
                  <td>
                    <input
                      aria-label={`${planLabel(planId)} list price USD`}
                      className="crud-input text-sm"
                      min={1}
                      max={1_000_000}
                      placeholder={String(DEFAULT_TENANT_PLAN_PRICE)}
                      title={`Default ${DEFAULT_TENANT_PLAN_PRICE} USD if cleared`}
                      type="number"
                      value={planDrafts[planId]?.price ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPlanDrafts((prev) => ({
                          ...prev,
                          [planId]: { ...prev[planId], price: v }
                        }));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${planLabel(planId)} Stripe product id`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      className="crud-input font-mono text-xs"
                      placeholder="prod_…"
                      spellCheck={false}
                      title="Optional prod_… — clear to use platform default"
                      value={planDrafts[planId]?.stripeProductId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPlanDrafts((prev) => ({
                          ...prev,
                          [planId]: { ...prev[planId], stripeProductId: v }
                        }));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${planLabel(planId)} Stripe price id`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      className="crud-input font-mono text-xs"
                      placeholder="price_…"
                      spellCheck={false}
                      title="Optional price_… — overrides STRIPE_PRICE_* for this tier; clear for env"
                      value={planDrafts[planId]?.stripePriceId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPlanDrafts((prev) => ({
                          ...prev,
                          [planId]: { ...prev[planId], stripePriceId: v }
                        }));
                      }}
                    />
                  </td>
                  {QUOTA_FIELDS.map((f) => {
                    const isHourly = f.key === "userChatHourlyLimit";
                    return (
                      <td key={f.key}>
                        <input
                          aria-label={`${planLabel(planId)} ${f.label}`}
                          className="crud-input text-sm"
                          min={isHourly ? 0 : 1}
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
                    );
                  })}
                  {PREF_FIELDS.map((f) =>
                    f.kind === "checkbox" ? (
                      <td key={f.key}>
                        <select
                          aria-label={`${planLabel(planId)} ${f.label}`}
                          className="crud-input text-sm"
                          title={`${f.hint} Use inherit for tenant default.`}
                          value={planDrafts[planId]?.[f.key] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [planId]: { ...prev[planId], [f.key]: v }
                            }));
                          }}
                        >
                          <option value="">inherit</option>
                          <option value="true">on</option>
                          <option value="false">off</option>
                        </select>
                      </td>
                    ) : (
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
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="admin-tenant-pref-meta">
        <summary>Field hints &amp; raw tenant_preferences</summary>
        <ul className="admin-muted admin-tenant-pref-hint-list">
          {QUOTA_FIELDS.map((f) => (
            <li key={f.key}>
              <strong>{f.label}:</strong> {f.hint}
            </li>
          ))}
          {PREF_FIELDS.map((f) => (
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
