"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EditIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type PersonaListItem = {
  _id?: string;
  name: string;
  model: string;
  defaultScope: string;
  enableRag: boolean;
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

export function PersonasOnboardingHome() {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);

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

      <div className="persona-directory-grid">
        {personas.map((persona) => {
          const collectionLabel = persona.xaiCollection.collectionId
            ? persona.xaiCollection.collectionName || persona.xaiCollection.collectionId
            : null;

          return (
            <article
              className="surface-card xf-widget persona-card"
              key={persona._id ?? persona.name}
            >
              <div className="persona-card-header">
                <h3>{persona.name}</h3>
                <div className="persona-card-badges">
                  <span className="status-badge status-ready">{persona.model}</span>
                  <span className="status-badge">{persona.defaultScope}</span>
                  {persona.enableRag ? (
                    <span className="status-badge status-pending">RAG</span>
                  ) : null}
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
              </div>

              <div className="tool-row">
                {persona._id ? (
                  <Link
                    className="tiny-button"
                    href={`/admin/personas/${persona._id}/edit`}
                  >
                    <EditIcon className="crud-icon" /> Edit
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {personas.length === 0 && !loading ? (
        <p className="status-text">
          No personas configured yet. Create one to get started.
        </p>
      ) : null}
    </section>
  );
}
