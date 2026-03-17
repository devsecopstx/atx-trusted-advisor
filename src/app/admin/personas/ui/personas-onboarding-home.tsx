"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BackIcon, EditIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
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

type CollectionInventoryItem = {
  id: string;
  name?: string;
  stats: {
    documentCount: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export function PersonasOnboardingHome() {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [collections, setCollections] = useState<CollectionInventoryItem[]>([]);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Loading personas and collections...");
    try {
      const [personaPayload, collectionsPayload] = await Promise.all([
        parseJson<{ data: PersonaListItem[] }>(await fetch("/api/personas")),
        parseJson<{ data: CollectionInventoryItem[] }>(await fetch("/api/personas/collections"))
      ]);
      setPersonas(personaPayload.data);
      setCollections(collectionsPayload.data);
      setStatus("Synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load onboarding data");
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
        <Link className="cta cta-secondary" href="/admin">
          <BackIcon className="crud-icon" /> Back to admin functions
        </Link>
        <button className="cta cta-secondary" disabled={loading} onClick={() => void refresh()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh onboarding
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Onboarding Flow</h3>
        <p className="status-text">Step 1: create collections. Step 2: create personas. Step 3: edit personas.</p>
        <div className="tool-row">
          <Link className="cta cta-primary" href="/admin/personas/collections/new">
            Create Collection
          </Link>
          <Link className="cta cta-primary" href="/admin/personas/new">
            Create Persona
          </Link>
        </div>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Personas ({personas.length})</h3>
        <ul className="data-list">
          {personas.map((persona) => (
            <li key={persona._id ?? persona.name}>
              <strong>{persona.name}</strong>
              <small>
                model={persona.model} scope={persona.defaultScope} rag={persona.enableRag ? "on" : "off"}
              </small>
              <small>
                xAPI={persona.xapi.mode} tool_choice={persona.xapi.toolChoice} max_turns=
                {persona.xapi.maxTurns} tools={persona.xapi.tools.length}
              </small>
              <small>
                collection={persona.xaiCollection.collectionId || "not bound"}
                {persona.xaiCollection.collectionName ? ` (${persona.xaiCollection.collectionName})` : ""}
              </small>
              <div className="tool-row">
                {persona._id ? (
                  <Link className="tiny-button" href={`/admin/personas/${persona._id}/edit`}>
                    <EditIcon className="crud-icon" /> Edit persona
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className="surface-card xf-widget section-card">
        <h3>Collections ({collections.length})</h3>
        <ul className="data-list">
          {collections.map((collection) => (
            <li key={collection.id}>
              <strong>{collection.name ?? "Unnamed collection"}</strong>
              <small>id={collection.id}</small>
              <small>docs={collection.stats.documentCount ?? "n/a"}</small>
              <div className="tool-row">
                <Link className="tiny-button" href={`/admin/personas/collections/${collection.id}/edit`}>
                  <EditIcon className="crud-icon" /> Edit collection
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
