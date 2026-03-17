"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EditIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

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

const STATUS_BADGE_CLASS: Record<PersonaStatus, string> = {
  draft: "status-warn",
  published: "status-live",
  archived: "status-ready"
};

export function PersonasOnboardingHome() {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        <p className="status-text">{status}</p>
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

      <div className="persona-directory-grid">
        {filtered.map((persona) => {
          const collectionLabel = persona.xaiCollection.collectionId
            ? persona.xaiCollection.collectionName || persona.xaiCollection.collectionId
            : null;
          const isActioning = actionLoading === persona._id;
          const prevVersion = persona.version > 1 ? persona.version - 1 : 0;

          return (
            <article
              className="surface-card xf-widget persona-card"
              key={persona._id ?? persona.name}
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
                {collectionLabel ? (
                  <small>Collection: {collectionLabel}</small>
                ) : (
                  <small className="status-text">No collection linked</small>
                )}
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
            </article>
          );
        })}
      </div>

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
