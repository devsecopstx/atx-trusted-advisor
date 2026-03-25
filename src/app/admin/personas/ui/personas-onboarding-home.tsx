"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { countPersonaLinkedCollections } from "@/modules/xchat/persona-linked-collections";

type PersonaStatus = "draft" | "published" | "archived";

type PersonaListItem = {
  _id?: string;
  name: string;
  model: string;
  defaultScope: string;
  enableRag: boolean;
  status: PersonaStatus;
  version: number;
  publishedAt: string | null;
  xapi: {
    mode: "responses" | "chat_completions";
    toolChoice: "auto" | "required" | "none";
    maxTurns: number;
    tools: Array<{ type: string; [key: string]: unknown }>;
  };
  xaiCollection: {
    collectionId: string;
    collectionName?: string;
  };
};

type StatusFilter = "all" | PersonaStatus;

type SyncFromXaiResult = {
  collectionId: string;
  collectionDisplayName: string;
  listed: number;
  examined: number;
  imported: number;
  updated: number;
  skipped: number;
  syntheticFallbacks: number;
  errors: Array<{ source: string; message: string }>;
};

type PersonasOnboardingHomeProps = {
  defaultXpersonasCollectionDisplayName: string;
};

const STATUS_BADGE_CLASS: Record<PersonaStatus, string> = {
  draft: "status-warn",
  published: "status-live",
  archived: "status-ready"
};

export function PersonasOnboardingHome({ defaultXpersonasCollectionDisplayName }: PersonasOnboardingHomeProps) {
  const reduceMotion = useReducedMotion();
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [platformDefaultPersonaId, setPlatformDefaultPersonaId] = useState("");
  const [platformDefaultStatus, setPlatformDefaultStatus] = useState<string | null>(null);
  const [platformDefaultLoading, setPlatformDefaultLoading] = useState(false);

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
      setPlatformDefaultStatus("Saved. App users without an admin-assigned persona use this published xPersona in xChat.");
      await loadPlatformXchatDefault();
    } catch (error) {
      setPlatformDefaultStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPlatformDefaultLoading(false);
    }
  }

  async function handleSyncFromXai() {
    setActionLoading("sync-xai");
    setStatus("Syncing personas from xAI collection…");
    try {
      const payload = await parseJson<{ data: SyncFromXaiResult }>(
        await fetch("/api/personas/sync-from-xai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "merge" })
        })
      );
      const d = payload.data;
      const errHint =
        d.errors.length > 0 ? ` · ${d.errors.length} file(s) skipped (see server logs / response)` : "";
      const syn =
        d.syntheticFallbacks > 0 ? ` · ${d.syntheticFallbacks} plain-text fallback` : "";
      setStatus(
        `xAI → DB: ${d.listed} listed, ${d.examined} examined → ${d.imported} new, ${d.updated} updated, ${d.skipped} skipped (${d.collectionDisplayName})${syn}${errHint}`
      );
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync from xAI failed");
    } finally {
      setActionLoading(null);
    }
  }

  const gridVariants = useMemo(
    () => ({
      hidden: { opacity: reduceMotion ? 1 : 0 },
      visible: {
        opacity: 1,
        transition: {
          when: "beforeChildren" as const,
          staggerChildren: reduceMotion ? 0 : 0.055,
          delayChildren: reduceMotion ? 0 : 0.04
        }
      }
    }),
    [reduceMotion]
  );

  const cardVariants = useMemo(
    () => ({
      hidden: {
        opacity: reduceMotion ? 1 : 0,
        y: reduceMotion ? 0 : 14
      },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] as const }
      }
    }),
    [reduceMotion]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading personas...");
    try {
      const payload = await parseJson<{ data: PersonaListItem[] }>(
        await fetch("/api/personas")
      );
      setPersonas(payload.data);
      setStatus(`${payload.data.length} persona${payload.data.length === 1 ? "" : "s"} loaded`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load personas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadPlatformXchatDefault();
  }, [loadPlatformXchatDefault]);

  const filtered = filter === "all" ? personas : personas.filter((p) => p.status === filter);
  const counts = {
    all: personas.length,
    draft: personas.filter((p) => p.status === "draft").length,
    published: personas.filter((p) => p.status === "published").length,
    archived: personas.filter((p) => p.status === "archived").length
  };

  async function handlePublish(personaId: string) {
    setActionLoading(personaId);
    try {
      await parseJson(await fetch(`/api/personas/${personaId}/publish`, { method: "POST" }));
      setStatus("Published successfully");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleArchive(personaId: string) {
    setActionLoading(personaId);
    try {
      await parseJson(await fetch(`/api/personas/${personaId}/archive`, { method: "POST" }));
      setStatus("Archived successfully");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Archive failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRollback(personaId: string, version: number) {
    if (version < 1) {
      setStatus("No previous version to rollback to");
      return;
    }
    setActionLoading(personaId);
    try {
      await parseJson(
        await fetch(`/api/personas/${personaId}/rollback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetVersion: version })
        })
      );
      setStatus(`Rolled back to v${version}`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rollback failed");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button
          className="cta cta-secondary"
          disabled={loading}
          onClick={() => void refresh()}
          type="button"
        >
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <Link className="cta cta-primary" href="/admin/personas/new">
          Create Persona
        </Link>
        <button
          className="cta cta-secondary"
          disabled={loading || actionLoading === "sync-xai"}
          onClick={() => void handleSyncFromXai()}
          title={`Reads YAML / frontmatter markdown from xAI collection “${defaultXpersonasCollectionDisplayName}” (override with XPERSONAS_XAI_COLLECTION_DISPLAY_NAME or API body collectionDisplayName).`}
          type="button"
        >
          Sync from xAI → DB
        </button>
        <p className="status-text">{status}</p>
      </div>

      <div className="surface-card xf-widget" style={{ padding: "1rem 1.1rem" }}>
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
          <label className="status-text" htmlFor="platform-default-xpersona">
            Platform default
          </label>
          <select
            className="font-mono text-sm"
            id="platform-default-xpersona"
            onChange={(e) => setPlatformDefaultPersonaId(e.target.value)}
            value={platformDefaultPersonaId}
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
            disabled={platformDefaultLoading || loading}
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

      <div className="tool-row">
        {(["all", "draft", "published", "archived"] as const).map((f) => (
          <button
            className={`tiny-button${filter === f ? " tiny-button-active" : ""}`}
            key={f}
            onClick={() => setFilter(f)}
            type="button"
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      <motion.div
        className="persona-directory-grid"
        key={filter}
        variants={gridVariants}
        initial="hidden"
        animate="visible"
      >
        {filtered.map((persona) => {
          const linkedCollectionCount = countPersonaLinkedCollections(persona);
          const collectionLabel = persona.xaiCollection.collectionId
            ? persona.xaiCollection.collectionName || persona.xaiCollection.collectionId
            : null;
          const isActioning = actionLoading === persona._id;
          const prevVersion = persona.version > 1 ? persona.version - 1 : 0;

          return (
            <motion.article
              className="surface-card xf-widget persona-card"
              key={persona._id ?? persona.name}
              variants={cardVariants}
            >
              <div className="persona-card-header">
                <h3>{persona.name}</h3>
                <div className="persona-card-badges">
                  <span className={`status-badge ${STATUS_BADGE_CLASS[persona.status]}`}>
                    {persona.status}
                  </span>
                  {persona.version > 0 ? (
                    <span className="status-badge">v{persona.version}</span>
                  ) : null}
                  <span className="status-badge status-ready">{persona.model}</span>
                </div>
              </div>

              <div className="persona-card-meta">
                <small>
                  xAPI: {persona.xapi.mode} | tool_choice: {persona.xapi.toolChoice} |
                  max_turns: {persona.xapi.maxTurns} | tools: {persona.xapi.tools.length}
                </small>
                <small>
                  Linked collections: {linkedCollectionCount}
                  {collectionLabel ? ` · primary: ${collectionLabel}` : ""}
                </small>
                {!collectionLabel && linkedCollectionCount === 0 ? (
                  <small className="status-text">No collection binding on persona</small>
                ) : null}
                {persona.publishedAt ? (
                  <small>Published: {new Date(persona.publishedAt).toLocaleString()}</small>
                ) : null}
              </div>

              <div className="tool-row">
                {persona._id ? (
                  <>
                    <Link
                      className="tiny-button"
                      href={`/admin/personas/${persona._id}/edit`}
                    >
                      <EditIcon className="crud-icon" /> Edit
                    </Link>
                    {persona.status !== "published" ? (
                      <button
                        className="tiny-button"
                        disabled={isActioning}
                        onClick={() => persona._id && void handlePublish(persona._id)}
                        type="button"
                      >
                        {isActioning ? "..." : "Publish"}
                      </button>
                    ) : null}
                    {persona.status !== "archived" ? (
                      <button
                        className="tiny-button"
                        disabled={isActioning}
                        onClick={() => persona._id && void handleArchive(persona._id)}
                        type="button"
                      >
                        {isActioning ? "..." : "Archive"}
                      </button>
                    ) : null}
                    {prevVersion > 0 ? (
                      <button
                        className="tiny-button"
                        disabled={isActioning}
                        onClick={() => persona._id && void handleRollback(persona._id, prevVersion)}
                        type="button"
                      >
                        {isActioning ? "..." : `Rollback to v${prevVersion}`}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </motion.article>
          );
        })}
      </motion.div>

      {filtered.length === 0 && !loading ? (
        <p className="status-text">
          {filter === "all"
            ? "No personas configured yet. Create one to get started."
            : `No ${filter} personas found.`}
        </p>
      ) : null}
    </section>
  );
}
