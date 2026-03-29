"use client";

import { useCallback, useEffect, useState } from "react";

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
    <div className="xf-widget section-card" style={{ padding: "1rem", maxWidth: 520 }}>
      <h3 className="hero-title" style={{ fontSize: "1.05rem", marginBottom: "0.35rem" }}>
        Default xChat persona (app users)
      </h3>
      <p className="status-text" style={{ marginBottom: "0.65rem" }}>
        Pick exactly one <strong>published</strong> xPersona from the list below (sync from xAI → DB first).
        App users who do not have an admin-assigned persona use this default in{" "}
        <code className="font-mono text-xs">/xchat</code>. Clearing falls back to the seeded trusted-advisor
        persona.
      </p>
      <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <label className="status-text" htmlFor="tenant-preferences-platform-default-xpersona">
          Platform default
        </label>
        <select
          className="font-mono text-sm"
          id="tenant-preferences-platform-default-xpersona"
          onChange={(e) => setPlatformDefaultPersonaId(e.target.value)}
          value={platformDefaultPersonaId}
          disabled={personaLoading}
        >
          <option value="">— Clear (trusted-advisor fallback) —</option>
          {personas
            .filter((p) => p.status === "published" && Boolean(p._id))
            .map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
        </select>
        <button
          className="cta cta-secondary"
          disabled={platformDefaultLoading || personaLoading}
          onClick={() => void handleSavePlatformXchatDefault()}
          type="button"
        >
          Save platform default
        </button>
      </div>
      {platformDefaultStatus ? (
        <p className="status-text" style={{ marginTop: "0.5rem" }}>
          {platformDefaultStatus}
        </p>
      ) : null}
    </div>
  );
}
