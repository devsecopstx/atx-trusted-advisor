"use client";

import { useCallback, useEffect, useState } from "react";

import { RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type PersonaListItem = {
  _id?: string;
  name: string;
  model: string;
  systemPrompt: string;
  defaultScope: string;
  enableRag: boolean;
  temperature?: number;
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

export function PersonaDirectory() {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading personas...");
    try {
      const payload = await parseJson<{ data: PersonaListItem[] }>(await fetch("/api/personas"));
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

  function toggleExpand(id: string | undefined) {
    if (!id) return;
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh
        </button>
        <p className="status-text">{status}</p>
      </div>

      <div className="persona-directory-grid">
        {personas.map((persona) => {
          const isExpanded = expandedId === persona._id;
          const collectionLabel = persona.xaiCollection.collectionId
            ? persona.xaiCollection.collectionName || persona.xaiCollection.collectionId
            : "No collection";

          return (
            <article
              className={`surface-card xf-widget persona-card ${isExpanded ? "persona-card-expanded" : ""}`}
              key={persona._id ?? persona.name}
            >
              <div
                className="persona-card-header"
                onClick={() => toggleExpand(persona._id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") toggleExpand(persona._id);
                }}
              >
                <h3>{persona.name}</h3>
                <div className="persona-card-badges">
                  <span className="status-badge status-ready">{persona.model}</span>
                  <span className="status-badge">{persona.defaultScope}</span>
                  {persona.enableRag ? <span className="status-badge status-pending">RAG</span> : null}
                </div>
              </div>

              <div className="persona-card-meta">
                <small>Collection: {collectionLabel}</small>
                <small>
                  xAPI: {persona.xapi.mode} | tools: {persona.xapi.tools.length} | tool_choice:{" "}
                  {persona.xapi.toolChoice} | max_turns: {persona.xapi.maxTurns}
                </small>
                {persona.temperature != null ? (
                  <small>Temperature: {persona.temperature}</small>
                ) : null}
              </div>

              {isExpanded ? (
                <div className="persona-card-detail">
                  <h4>System Prompt</h4>
                  <pre className="persona-prompt-pre">{persona.systemPrompt}</pre>
                  {persona.xapi.tools.length > 0 ? (
                    <>
                      <h4>Tools</h4>
                      <ul className="data-list">
                        {persona.xapi.tools.map((tool, idx) => (
                          <li key={idx}>
                            <code>{tool.type}</code>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="persona-card-hint">Tap to expand details</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
