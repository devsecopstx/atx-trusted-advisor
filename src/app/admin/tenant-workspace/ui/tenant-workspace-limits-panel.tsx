"use client";

import { useCallback, useEffect, useState } from "react";

import { SaveIcon } from "@/app/admin/ui/crud-icons";
import type { TenantBrandingPreferences } from "@/modules/identity/tenant-branding-preferences";
import type { TenantWorkspaceLimits } from "@/modules/identity/tenant-workspace-limits";

type Props = {
  tenantId: string;
};

const FIELDS: { key: keyof TenantWorkspaceLimits; label: string; hint: string }[] = [
  {
    key: "userXoptionsLimit",
    label: "xoptions deck views / day (per user)",
    hint: "Signed-in users: main pitch + follow-up pages share this daily bucket (UTC)."
  },
  {
    key: "userChatLimit",
    label: "xChat prompts / day (per user)",
    hint: "Capped with subscription plan: effective daily = min(plan, this value)."
  },
  {
    key: "tenantPortfolioLimit",
    label: "Portfolios per user (tenant)",
    hint: "Blocks extra portfolio rows in tenant_portfolio for this tenant."
  },
  {
    key: "portfolioAccountLimit",
    label: "Accounts per portfolio",
    hint: "Blocks extra portfolio_accounts beyond this count (provisioned default counts)."
  }
];

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
          tenantPreferences: {
            ...tenantPreferences,
            xchat_debug_enabled: xchatDebugEnabled
          }
        })
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: {
          workspaceLimits?: TenantWorkspaceLimits;
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
    <form className="xf-widget section-card" onSubmit={(e) => void onSave(e)} style={{ padding: "1rem", maxWidth: 520 }}>
      <p className="admin-session-popover__eyebrow">Tenant</p>
      <p style={{ marginTop: 0 }}>
        <code className="font-mono text-xs">{slug || tenantId}</code>
      </p>
      {FIELDS.map((f) => (
        <label key={f.key} style={{ display: "grid", gap: "0.25rem", marginBottom: "0.85rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{f.label}</span>
          <input
            className="crud-input text-sm"
            min={1}
            max={1_000_000}
            required
            type="number"
            value={values[f.key]}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              setValues((prev) => (prev ? { ...prev, [f.key]: Number.isFinite(n) ? n : prev[f.key] } : prev));
            }}
          />
          <span className="admin-muted" style={{ fontSize: "0.72rem" }}>
            {f.hint}
          </span>
        </label>
      ))}
      <hr style={{ borderColor: "var(--xf-text-400)", opacity: 0.25, margin: "0 0 0.85rem" }} />
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.85rem",
          cursor: "pointer"
        }}
      >
        <input
          type="checkbox"
          checked={xchatDebugEnabled}
          onChange={(e) => setXchatDebugEnabled(e.target.checked)}
        />
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          Enable xChat debug logs for this tenant
        </span>
      </label>
      <p className="admin-muted" style={{ fontSize: "0.72rem", marginTop: "-0.5rem", marginBottom: "0.85rem" }}>
        Sets <code className="font-mono text-xs">tenantPreferences.xchat_debug_enabled</code> — opt-in{" "}
        <code className="font-mono text-xs">[xchat/debug]</code> Cloud Logging (same taxonomy as{" "}
        <code className="font-mono text-xs">ENABLE_XCHAT_DEBUG</code>).
      </p>
      <p className="admin-session-popover__eyebrow">Tenant preferences (one-time set)</p>
      <label style={{ display: "grid", gap: "0.25rem", marginBottom: "0.85rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>xchat_brandname</span>
        <input
          className="crud-input text-sm"
          placeholder="e.g. Alpha Desk Chat"
          value={tenantPreferences.xchat_brandname ?? ""}
          disabled={Boolean(tenantPreferences.xchat_brandname)}
          onChange={(e) =>
            setTenantPreferences((prev) => ({
              ...prev,
              xchat_brandname: e.target.value
            }))
          }
        />
        <span className="admin-muted" style={{ fontSize: "0.72rem" }}>
          Admin-set once on <code className="font-mono text-xs">core_tenants.tenantPreferences.xchat_brandname</code>.
        </span>
      </label>
      <label style={{ display: "grid", gap: "0.25rem", marginBottom: "0.85rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>xstrategybuilder_brandname</span>
        <input
          className="crud-input text-sm"
          placeholder="e.g. Alpha Strategy Lab"
          value={tenantPreferences.xstrategybuilder_brandname ?? ""}
          disabled={Boolean(tenantPreferences.xstrategybuilder_brandname)}
          onChange={(e) =>
            setTenantPreferences((prev) => ({
              ...prev,
              xstrategybuilder_brandname: e.target.value
            }))
          }
        />
        <span className="admin-muted" style={{ fontSize: "0.72rem" }}>
          Admin-set once on{" "}
          <code className="font-mono text-xs">core_tenants.tenantPreferences.xstrategybuilder_brandname</code>.
        </span>
      </label>
      <div style={{ marginBottom: "0.85rem" }}>
        <p className="admin-session-popover__eyebrow" style={{ marginBottom: "0.4rem" }}>
          tenant_preferences (read-only)
        </p>
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
        <p className="admin-muted" style={{ fontSize: "0.72rem", marginTop: "0.35rem" }}>
          Unknown or legacy keys are intentionally read-only in this panel.
        </p>
      </div>
      {err ? (
        <p className="status-text status-error" style={{ marginBottom: "0.5rem" }}>
          {err}
        </p>
      ) : null}
      {status ? (
        <p className="status-text" style={{ marginBottom: "0.5rem" }}>
          {status}
        </p>
      ) : null}
      <button className="cta cta-primary" disabled={saving} type="submit">
        <SaveIcon className="crud-icon" /> {saving ? "Saving…" : "Save workspace limits"}
      </button>
    </form>
  );
}
