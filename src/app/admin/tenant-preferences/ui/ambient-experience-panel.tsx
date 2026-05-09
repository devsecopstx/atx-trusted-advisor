"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type LoadResponse = {
  data: {
    tenantId: string;
    tenantPreferences?: { ambient_market_veil?: boolean | null } | null;
  };
};

type AmbientExperiencePanelProps = {
  tenantId: string;
};

type VeilChoice = "default-on" | "on" | "off";

function veilChoiceFromPreference(raw: unknown): VeilChoice {
  if (raw === false) {
    return "off";
  }
  if (raw === true) {
    return "on";
  }
  return "default-on";
}

function payloadFromVeilChoice(choice: VeilChoice): boolean | null {
  if (choice === "off") {
    return false;
  }
  if (choice === "on") {
    return true;
  }
  return null;
}

export function AmbientExperiencePanel({ tenantId }: AmbientExperiencePanelProps) {
  const [veilChoice, setVeilChoice] = useState<VeilChoice>("default-on");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const payload = await parseJson<LoadResponse>(
        await fetch(`/api/admin/tenants/${tenantId}/workspace-limits`)
      );
      setVeilChoice(veilChoiceFromPreference(payload.data.tenantPreferences?.ambient_market_veil));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load tenant preferences");
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
          body: JSON.stringify({
            tenantPreferences: {
              ambient_market_veil: payloadFromVeilChoice(veilChoice)
            }
          })
        })
      );
      setStatus(
        veilChoice === "off"
          ? "Saved. Ambient Market Veil is hidden for this tenant on /xchat, /xoptions, and /portfolios."
          : "Saved. Ambient Market Veil is enabled (default) on /xchat, /xoptions, and /portfolios."
      );
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="xf-widget section-card admin-tenant-pref-form">
      <p className="admin-muted" style={{ marginBottom: "0.75rem", maxWidth: 640 }}>
        Subtle teal grid + drifting accent particles behind app_user product chrome (initially{" "}
        <code className="font-mono text-xs">/xchat</code>, <code className="font-mono text-xs">/xoptions</code>,{" "}
        <code className="font-mono text-xs">/portfolios</code>). Pure Canvas2D, defers behind page{" "}
        <code className="font-mono text-xs">load</code>, auto-throttles below 45 fps, and respects{" "}
        <code className="font-mono text-xs">prefers-reduced-motion</code>. Default-on for paid tenants — pick{" "}
        <strong>Off</strong> to hide it for everyone in this tenant.
      </p>

      <div className="crud-table-wrap admin-tenant-pref-table-wrap">
        <table className="crud-table admin-tenant-pref-crud-table">
          <thead>
            <tr>
              <th scope="col">Ambient Market Veil</th>
              <th scope="col" className="admin-tenant-pref-crud-table__actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <fieldset disabled={loading} style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                    <input
                      checked={veilChoice === "default-on"}
                      name="ambient-market-veil"
                      type="radio"
                      value="default-on"
                      onChange={() => setVeilChoice("default-on")}
                    />
                    <span>Default (on for paid tenants)</span>
                  </label>
                  <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                    <input
                      checked={veilChoice === "on"}
                      name="ambient-market-veil"
                      type="radio"
                      value="on"
                      onChange={() => setVeilChoice("on")}
                    />
                    <span>On (force-enable)</span>
                  </label>
                  <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                    <input
                      checked={veilChoice === "off"}
                      name="ambient-market-veil"
                      type="radio"
                      value="off"
                      onChange={() => setVeilChoice("off")}
                    />
                    <span>Off (hide for tenant)</span>
                  </label>
                </fieldset>
              </td>
              <td className="admin-tenant-pref-crud-table__actions">
                <div className="admin-tenant-pref-action-stack admin-tenant-pref-action-stack--horizontal">
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
                    disabled={loading || saving}
                    type="button"
                    onClick={() => void handleSave()}
                  >
                    <SaveIcon className="crud-icon" aria-hidden />
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {status ? (
        <p className="status-text" style={{ marginTop: "0.65rem" }}>
          {status}
        </p>
      ) : null}
    </div>
  );
}
