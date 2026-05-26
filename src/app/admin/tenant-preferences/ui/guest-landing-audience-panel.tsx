"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import type { GuestLandingVariant } from "@/lib/marketing/guest-landing-variant";

type LoadResponse = {
  data: {
    tenantId: string;
    slug?: string;
    tenantPreferences?: { guest_landing_audience?: string | null } | null;
    tenantPreferencesRaw?: Record<string, unknown>;
  };
};

type GuestLandingAudiencePanelProps = {
  tenantId: string;
};

type AudienceChoice = GuestLandingVariant | "platform-default";

function audienceFromPreference(raw: unknown): AudienceChoice {
  if (raw === "hnwi" || raw === "advisor") {
    return raw;
  }
  return "platform-default";
}

function payloadFromChoice(choice: AudienceChoice): "hnwi" | "advisor" | null {
  if (choice === "platform-default") {
    return null;
  }
  return choice;
}

export function GuestLandingAudiencePanel({ tenantId }: GuestLandingAudiencePanelProps) {
  const [choice, setChoice] = useState<AudienceChoice>("platform-default");
  const [slug, setSlug] = useState("");
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
      setSlug(payload.data.slug ?? "");
      const raw =
        payload.data.tenantPreferencesRaw?.guest_landing_audience ??
        payload.data.tenantPreferences?.guest_landing_audience;
      setChoice(audienceFromPreference(raw));
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
              guest_landing_audience: payloadFromChoice(choice)
            }
          })
        })
      );
      const label =
        choice === "hnwi"
          ? "HNWI retail"
          : choice === "advisor"
            ? "Investment Advisor / firm"
            : "platform default (HNWI)";
      setStatus(
        `Saved. Anonymous guests on / and /home for tenant ${slug || tenantId} use ${label} when no ?for= query or cookie is set.`
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
      <p className="admin-muted" style={{ marginBottom: "0.75rem", maxWidth: 720 }}>
        Default marketing hero for unauthenticated visitors on <code className="font-mono text-xs">/</code> and{" "}
        <code className="font-mono text-xs">/home</code>. Precedence: URL{" "}
        <code className="font-mono text-xs">?for=hnwi|advisor</code> → cookie{" "}
        <code className="font-mono text-xs">xf_guest_landing_for</code> → this tenant setting → HNWI (global default).
        Set on the <strong>platform default</strong> tenant to steer production blast traffic.
      </p>

      <div className="crud-table-wrap admin-tenant-pref-table-wrap">
        <table className="crud-table admin-tenant-pref-crud-table">
          <thead>
            <tr>
              <th scope="col">Guest landing audience</th>
              <th scope="col" className="admin-tenant-pref-crud-table__actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <fieldset disabled={loading} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="guest-landing-audience"
                      checked={choice === "hnwi"}
                      onChange={() => setChoice("hnwi")}
                    />
                    <span className="text-sm text-[var(--xf-text-100)]">HNWI retail (Austin)</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="guest-landing-audience"
                      checked={choice === "advisor"}
                      onChange={() => setChoice("advisor")}
                    />
                    <span className="text-sm text-[var(--xf-text-100)]">Investment Advisor / firm</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="guest-landing-audience"
                      checked={choice === "platform-default"}
                      onChange={() => setChoice("platform-default")}
                    />
                    <span className="text-sm text-[var(--xf-text-200)]">Unset (falls back to HNWI)</span>
                  </label>
                </fieldset>
              </td>
              <td className="admin-tenant-pref-crud-table__actions">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-[var(--xf-muted-border)] px-2 py-1 text-xs text-[var(--xf-text-200)] hover:bg-[var(--xf-surface-2)]"
                    onClick={() => void refresh()}
                    disabled={loading}
                  >
                    <RefreshIcon /> Reload
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded bg-[var(--xf-gain-green)] px-3 py-1 text-xs font-semibold text-[var(--xf-bg-900)] hover:opacity-90 disabled:opacity-50"
                    onClick={() => void handleSave()}
                    disabled={loading || saving}
                  >
                    <SaveIcon /> Save
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {status ? (
        <p className="mt-3 text-sm text-[var(--xf-text-300)]" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
