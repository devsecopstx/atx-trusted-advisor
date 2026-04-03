"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type PersonaListItem = {
  _id?: string;
  name: string;
  status: "draft" | "published" | "archived";
};

export function XchatDefaultPersonaPanel() {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [platformDefaultPersonaId, setPlatformDefaultPersonaId] = useState("");
  const [platformDefaultStatus, setPlatformDefaultStatus] = useState<string | null>(null);
  const [platformDefaultLoading, setPlatformDefaultLoading] = useState(false);

  const refreshPublishedPersonas = useCallback(async () => {
    setPersonaLoading(true);
    try {
      const payload = await parseJson<{ data: PersonaListItem[] }>(await fetch("/api/personas"));
      setPersonas(payload.data);
      setPlatformDefaultStatus(null);
    } catch (error) {
      setPlatformDefaultStatus(error instanceof Error ? error.message : "Could not load xPersonas");
    } finally {
      setPersonaLoading(false);
    }
  }, []);

  const loadPlatformXchatDefault = useCallback(async () => {
    try {
      const payload = await parseJson<{
        data: { defaultAppUserPersonaId: string | null };
      }>(await fetch("/api/admin/xchat/settings"));
      setPlatformDefaultPersonaId(payload.data.defaultAppUserPersonaId?.trim() ?? "");
    } catch {
      setPlatformDefaultStatus("Could not load platform xChat default (admin session required).");
    }
  }, []);

  async function handleSavePlatformXchatDefault() {
    setPlatformDefaultLoading(true);
    setPlatformDefaultStatus(null);
    try {
      const trimmed = platformDefaultPersonaId.trim();
      await parseJson(
        await fetch("/api/admin/xchat/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultAppUserPersonaId: trimmed.length > 0 ? trimmed : null
          })
        })
      );
      setPlatformDefaultStatus(
        "Saved. App users without an admin-assigned persona use this published xPersona in xChat."
      );
      await loadPlatformXchatDefault();
    } catch (error) {
      setPlatformDefaultStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPlatformDefaultLoading(false);
    }
  }

  useEffect(() => {
    void refreshPublishedPersonas();
  }, [refreshPublishedPersonas]);

  useEffect(() => {
    void loadPlatformXchatDefault();
  }, [loadPlatformXchatDefault]);

  return (
    <div className="xf-widget section-card admin-tenant-pref-form">
      <p className="admin-muted" style={{ marginBottom: "0.75rem", maxWidth: 640 }}>
        Pick a <strong>published</strong> xPersona for the platform default (after xAI sync, publish in Manage xPersonas).{" "}
        <strong>Draft</strong> rows appear below for visibility — select a published row to save. Users without an
        assigned persona get this default in <code className="font-mono text-xs">/xchat</code>. Clear to use the seeded
        trusted-advisor fallback.
      </p>

      <div className="crud-table-wrap admin-tenant-pref-table-wrap">
        <table className="crud-table admin-tenant-pref-crud-table">
          <thead>
            <tr>
              <th scope="col">Platform default xPersona</th>
              <th scope="col" className="admin-tenant-pref-crud-table__actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <select
                  aria-label="Platform default xPersona"
                  className="crud-input text-sm font-mono"
                  disabled={personaLoading}
                  id="tenant-preferences-platform-default-xpersona"
                  value={platformDefaultPersonaId}
                  onChange={(e) => setPlatformDefaultPersonaId(e.target.value)}
                >
                  <option value="">— Clear (trusted-advisor fallback) —</option>
                  {personas
                    .filter((p) => Boolean(p._id) && (p.status === "published" || p.status === "draft"))
                    .map((p) => {
                      const id = p._id as string;
                      const isPublished = p.status === "published";
                      return (
                        <option key={id} disabled={!isPublished} value={id}>
                          {isPublished ? p.name : `${p.name} (draft — publish first)`}
                        </option>
                      );
                    })}
                </select>
              </td>
              <td className="admin-tenant-pref-crud-table__actions">
                <div className="admin-tenant-pref-action-stack admin-tenant-pref-action-stack--horizontal">
                  <button
                    className="cta cta-secondary"
                    disabled={personaLoading}
                    type="button"
                    onClick={() => void refreshPublishedPersonas()}
                  >
                    <RefreshIcon className="crud-icon" aria-hidden />
                    Reload list
                  </button>
                  <button
                    className="cta cta-primary"
                    disabled={platformDefaultLoading || personaLoading}
                    type="button"
                    onClick={() => void handleSavePlatformXchatDefault()}
                  >
                    <SaveIcon className="crud-icon" aria-hidden />
                    {platformDefaultLoading ? "Saving…" : "Save"}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {platformDefaultStatus ? (
        <p className="status-text" style={{ marginTop: "0.65rem" }}>
          {platformDefaultStatus}
        </p>
      ) : null}
    </div>
  );
}
