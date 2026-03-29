"use client";

import { useCallback, useEffect, useState } from "react";

import { SaveIcon } from "@/app/admin/ui/crud-icons";
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
  const [slug, setSlug] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/workspace-limits`, {
        credentials: "include"
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { workspaceLimits?: TenantWorkspaceLimits; slug?: string };
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
        body: JSON.stringify({ workspaceLimits: values })
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { workspaceLimits?: TenantWorkspaceLimits };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      if (payload.data?.workspaceLimits) {
        setValues(payload.data.workspaceLimits);
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
