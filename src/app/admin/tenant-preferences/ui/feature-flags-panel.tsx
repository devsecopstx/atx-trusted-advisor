"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type FeatureFlagValue = boolean | number | string;

type LoadResponse = {
  data: {
    tenantId: string;
    tenantPreferences?: { featureFlags?: Record<string, FeatureFlagValue> | null } | null;
  };
};

type FeatureFlagsPanelProps = {
  tenantId: string;
};

type FlagEntry = {
  key: string;
  value: FeatureFlagValue;
};

const FLAG_KEY_RE = /^[a-z0-9][a-z0-9-]*$/;

function sortedFlags(flags: Record<string, FeatureFlagValue>): FlagEntry[] {
  return Object.entries(flags)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function displayValue(val: FeatureFlagValue): string {
  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }
  return String(val);
}

function valueType(val: FeatureFlagValue): "boolean" | "number" | "string" {
  if (typeof val === "boolean") return "boolean";
  if (typeof val === "number") return "number";
  return "string";
}

export function FeatureFlagsPanel({ tenantId }: FeatureFlagsPanelProps) {
  const [flags, setFlags] = useState<Record<string, FeatureFlagValue>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<"boolean" | "number" | "string">("boolean");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    setDirty(false);
    try {
      const payload = await parseJson<LoadResponse>(
        await fetch(`/api/admin/tenants/${tenantId}/workspace-limits`)
      );
      setFlags(payload.data.tenantPreferences?.featureFlags ?? {});
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load feature flags");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      await parseJson(
        await fetch(`/api/admin/tenants/${tenantId}/workspace-limits`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureFlags: flags })
        })
      );
      setStatus("Feature flags saved — changes are live for all signed-in users.");
      setDirty(false);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleFlag(key: string) {
    setFlags((prev) => {
      const current = prev[key];
      if (typeof current === "boolean") {
        return { ...prev, [key]: !current };
      }
      return prev;
    });
    setDirty(true);
  }

  function updateFlagValue(key: string, raw: string) {
    setFlags((prev) => {
      const current = prev[key];
      const type = valueType(current);
      if (type === "number") {
        const n = Number(raw);
        if (Number.isFinite(n)) {
          return { ...prev, [key]: n };
        }
        return prev;
      }
      return { ...prev, [key]: raw };
    });
    setDirty(true);
  }

  function removeFlag(key: string) {
    setFlags((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDirty(true);
  }

  function handleAddFlag(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const trimmedKey = newKey.trim().toLowerCase();
    if (!trimmedKey) {
      setAddError("Key is required");
      return;
    }
    if (!FLAG_KEY_RE.test(trimmedKey) || trimmedKey.length > 64) {
      setAddError("Key must be lowercase kebab-case (a-z0-9, hyphens), max 64 chars");
      return;
    }
    if (flags[trimmedKey] !== undefined) {
      setAddError(`Flag "${trimmedKey}" already exists`);
      return;
    }
    let value: FeatureFlagValue;
    if (newType === "boolean") {
      value = false;
    } else if (newType === "number") {
      const n = Number(newValue || "0");
      value = Number.isFinite(n) ? n : 0;
    } else {
      value = newValue;
    }
    setFlags((prev) => ({ ...prev, [trimmedKey]: value }));
    setNewKey("");
    setNewValue("");
    setDirty(true);
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sorted = sortedFlags(flags);

  return (
    <div className="xf-widget section-card admin-tenant-pref-form">
      <p className="admin-muted" style={{ marginBottom: "0.75rem", maxWidth: 640 }}>
        Runtime feature toggles for this tenant. Code reads flags via{" "}
        <code className="font-mono text-xs">isFeatureEnabled(tenant, &apos;flag-key&apos;)</code>.
        Flag values are live immediately after save — no deploy needed.
      </p>

      <div className="crud-table-wrap admin-tenant-pref-table-wrap">
        <table className="crud-table admin-tenant-pref-crud-table">
          <thead>
            <tr>
              <th scope="col">Flag key</th>
              <th scope="col">Type</th>
              <th scope="col">Value</th>
              <th scope="col" className="admin-tenant-pref-crud-table__actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} className="admin-muted" style={{ textAlign: "center" }}>
                  No feature flags configured. Add one below.
                </td>
              </tr>
            ) : null}
            {sorted.map(({ key, value }) => {
              const type = valueType(value);
              return (
                <tr key={key}>
                  <td>
                    <code className="font-mono text-xs">{key}</code>
                  </td>
                  <td>
                    <span className="text-xs text-[var(--xf-muted-fg)]">{type}</span>
                  </td>
                  <td>
                    {type === "boolean" ? (
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                          value
                            ? "bg-[var(--xf-gain-green)]/20 text-[var(--xf-gain-green)]"
                            : "bg-[var(--xf-loss-red)]/20 text-[var(--xf-loss-red)]"
                        }`}
                        onClick={() => toggleFlag(key)}
                        aria-label={`Toggle ${key}`}
                      >
                        {value ? "ON" : "OFF"}
                      </button>
                    ) : (
                      <input
                        aria-label={`Value for ${key}`}
                        className="crud-input text-sm font-mono"
                        type={type === "number" ? "number" : "text"}
                        value={displayValue(value)}
                        onChange={(e) => updateFlagValue(key, e.target.value)}
                      />
                    )}
                  </td>
                  <td className="admin-tenant-pref-crud-table__actions">
                    <button
                      className="cta cta-secondary text-xs"
                      type="button"
                      onClick={() => removeFlag(key)}
                      aria-label={`Remove flag ${key}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={handleAddFlag}
      >
        <div>
          <label htmlFor="ff-new-key" className="block text-xs font-semibold text-[var(--xf-muted-fg)]">
            New flag key
          </label>
          <input
            id="ff-new-key"
            className="crud-input text-sm font-mono"
            placeholder="my-new-feature"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ff-new-type" className="block text-xs font-semibold text-[var(--xf-muted-fg)]">
            Type
          </label>
          <select
            id="ff-new-type"
            className="crud-input text-sm"
            value={newType}
            onChange={(e) => setNewType(e.target.value as "boolean" | "number" | "string")}
          >
            <option value="boolean">boolean</option>
            <option value="number">number</option>
            <option value="string">string</option>
          </select>
        </div>
        {newType !== "boolean" ? (
          <div>
            <label htmlFor="ff-new-value" className="block text-xs font-semibold text-[var(--xf-muted-fg)]">
              Initial value
            </label>
            <input
              id="ff-new-value"
              className="crud-input text-sm font-mono"
              placeholder={newType === "number" ? "0" : ""}
              type={newType === "number" ? "number" : "text"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          </div>
        ) : null}
        <button className="cta cta-secondary text-sm" type="submit">
          + Add flag
        </button>
        {addError ? <span className="text-xs text-[var(--xf-loss-red)]">{addError}</span> : null}
      </form>

      <div className="mt-4 flex items-center gap-2">
        <button
          className="cta cta-secondary"
          disabled={loading || saving}
          type="button"
          onClick={() => void refresh()}
        >
          <RefreshIcon className="crud-icon" aria-hidden />
          Reload
        </button>
        <button
          className="cta cta-primary"
          disabled={loading || saving || !dirty}
          type="button"
          onClick={() => void handleSave()}
        >
          <SaveIcon className="crud-icon" aria-hidden />
          {saving ? "Saving…" : "Save flags"}
        </button>
        {dirty ? (
          <span className="text-xs text-[var(--xf-muted-fg)]">Unsaved changes</span>
        ) : null}
      </div>

      {status ? (
        <p className="status-text" style={{ marginTop: "0.65rem" }}>
          {status}
        </p>
      ) : null}
    </div>
  );
}
