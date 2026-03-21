"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT } from "@/app/admin/personas/ui/personas-onboarding";
import { DeleteIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type PersonaEditorPageProps = {
  mode: "create" | "edit";
  personaId?: string;
};

type ToolSelections = {
  web_search: boolean;
  x_search: boolean;
  collection_search: boolean;
  atxfinance: boolean;
};

type PersonaPayload = {
  name: string;
  systemPrompt: string;
  overridePrompt: string;
  xaiCollectionId: string;
  xaiCollectionName: string;
  model: string;
  temperature: string;
  enableRag: boolean;
  defaultScope: string;
  xapiMode: "responses" | "chat_completions";
  xapiToolChoice: "auto" | "required" | "none";
  xapiMaxTurns: string;
  tools: ToolSelections;
};

type CollectionRow = {
  id: string;
  name?: string;
  stats: { documentCount: number | null; createdAt: string | null; updatedAt: string | null };
};

const EMPTY_FORM: PersonaPayload = {
  name: "",
  systemPrompt: DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT,
  overridePrompt: "",
  xaiCollectionId: "",
  xaiCollectionName: "",
  model: "grok-4-1-fast-reasoning",
  temperature: "0.2",
  enableRag: true,
  defaultScope: "global",
  xapiMode: "responses",
  xapiToolChoice: "auto",
  xapiMaxTurns: "5",
  tools: {
    web_search: true,
    x_search: true,
    collection_search: true,
    atxfinance: false
  }
};

function toolSelectionsFromArray(
  tools: Array<{ type: string; [key: string]: unknown }>
): ToolSelections {
  return {
    web_search: tools.some((t) => t.type === "web_search"),
    x_search: tools.some((t) => t.type === "x_search"),
    collection_search: tools.some(
      (t) => t.type === "file_search" || t.type === "collections_search"
    ),
    atxfinance: tools.some((t) => t.type === "atxfinance")
  };
}

function toolSelectionsToArray(
  selections: ToolSelections,
  collectionId: string
): Array<{ type: string; [key: string]: unknown }> {
  const tools: Array<{ type: string; [key: string]: unknown }> = [];
  if (selections.web_search) tools.push({ type: "web_search" });
  if (selections.x_search) tools.push({ type: "x_search" });
  if (selections.collection_search) {
    const boundId = collectionId.trim();
    tools.push(
      boundId
        ? { type: "collections_search", collection_ids: [boundId] }
        : { type: "collections_search" }
    );
  }
  if (selections.atxfinance) tools.push({ type: "atxfinance" });
  return tools;
}

export function PersonaEditorPage({ mode, personaId }: PersonaEditorPageProps) {
  const [form, setForm] = useState<PersonaPayload>(EMPTY_FORM);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(mode === "edit");
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionsStatus, setCollectionsStatus] = useState<string | null>(null);
  const router = useRouter();

  const collectionSearchMissingCollection =
    form.tools.collection_search && !form.xaiCollectionId.trim();

  useEffect(() => {
    void (async () => {
      try {
        const payload = await parseJson<{ data: CollectionRow[] }>(
          await fetch("/api/personas/collections")
        );
        setCollections(payload.data);
      } catch (error) {
        setCollectionsStatus(
          error instanceof Error ? error.message : "Could not load RAG collections"
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !personaId) {
      return;
    }
    void (async () => {
      try {
        const payload = await parseJson<{
          data: {
            name: string;
            systemPrompt: string;
            overridePrompt: string;
            xaiCollection: { collectionId: string; collectionName?: string };
            model: string;
            temperature: number;
            enableRag: boolean;
            defaultScope: string;
            xapi: {
              mode: "responses" | "chat_completions";
              toolChoice: "auto" | "required" | "none";
              maxTurns: number;
              tools: Array<{ type: string; [key: string]: unknown }>;
            };
          };
        }>(await fetch(`/api/personas/${personaId}`));
        setForm({
          name: payload.data.name,
          systemPrompt: payload.data.systemPrompt,
          overridePrompt: payload.data.overridePrompt ?? "",
          xaiCollectionId: payload.data.xaiCollection.collectionId ?? "",
          xaiCollectionName: payload.data.xaiCollection.collectionName ?? "",
          model: payload.data.model,
          temperature: String(payload.data.temperature),
          enableRag: payload.data.enableRag,
          defaultScope: payload.data.defaultScope,
          xapiMode: payload.data.xapi.mode,
          xapiToolChoice: payload.data.xapi.toolChoice,
          xapiMaxTurns: String(payload.data.xapi.maxTurns),
          tools: toolSelectionsFromArray(payload.data.xapi.tools)
        });
        setStatus("Loaded");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load persona");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, personaId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedTemperature = Number(form.temperature.replace(",", ".").trim());
    const parsedMaxTurns = Number(form.xapiMaxTurns.trim());
    if (!Number.isFinite(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 1) {
      setStatus("Temperature must be a number between 0 and 1");
      return;
    }
    if (!Number.isInteger(parsedMaxTurns) || parsedMaxTurns < 1 || parsedMaxTurns > 10) {
      setStatus("max_turns must be an integer between 1 and 10");
      return;
    }
    if (collectionSearchMissingCollection) {
      setStatus(
        "Collection search requires a linked collection id. Pick one from the list or paste an id."
      );
      return;
    }

    const parsedTools = toolSelectionsToArray(form.tools, form.xaiCollectionId);

    setStatus(mode === "create" ? "Creating persona..." : "Saving persona...");
    try {
      const endpoint = mode === "create" ? "/api/personas" : `/api/personas/${personaId}`;
      const method = mode === "create" ? "POST" : "PUT";
      await parseJson(
        await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            systemPrompt: form.systemPrompt,
            overridePrompt: form.overridePrompt,
            xaiCollection: {
              collectionId: form.xaiCollectionId,
              collectionName: form.xaiCollectionName
            },
            model: form.model,
            temperature: parsedTemperature,
            enableRag: form.enableRag,
            defaultScope: form.defaultScope,
            xapi: {
              mode: form.xapiMode,
              toolChoice: form.xapiToolChoice,
              maxTurns: parsedMaxTurns,
              tools: parsedTools
            }
          })
        })
      );
      router.push("/admin/personas");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save persona");
    }
  }

  function toggleTool(toolType: keyof ToolSelections) {
    setForm((current) => ({
      ...current,
      tools: { ...current.tools, [toolType]: !current.tools[toolType] }
    }));
  }

  function applyCollection(row: CollectionRow) {
    setForm((current) => ({
      ...current,
      xaiCollectionId: row.id,
      xaiCollectionName: row.name ?? current.xaiCollectionName
    }));
  }

  async function copyCollectionId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setStatus("Copied collection id");
    } catch {
      setStatus("Copy failed — select the id manually");
    }
  }

  async function onDelete() {
    if (!personaId || mode !== "edit") return;
    if (!window.confirm(`Delete persona "${form.name}"? This cannot be undone.`)) return;
    setStatus("Deleting persona...");
    try {
      const res = await fetch(`/api/personas/${personaId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Delete failed (${res.status})`);
      }
      router.push("/admin/personas");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete persona");
    }
  }

  return (
    <section className="panel stack-gap">
      <article className="surface-card xf-widget section-card">
        <h3>{mode === "create" ? "Create Persona" : "Edit Persona"}</h3>
        <p className="status-text">{loading ? "Loading..." : status}</p>
        <form className="stack-form" onSubmit={onSubmit}>
          <input
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="persona name"
            required
            value={form.name}
          />
          <textarea
            onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
            placeholder="system prompt (sent as chat system message)"
            required
            rows={6}
            value={form.systemPrompt}
          />
          <textarea
            onChange={(event) =>
              setForm((current) => ({ ...current, overridePrompt: event.target.value }))
            }
            placeholder="override prompt — prepended to each user message for xChat"
            rows={4}
            value={form.overridePrompt}
          />
          <label className="status-text">
            Linked collection id (for RAG + collections_search tools)
          </label>
          <input
            onChange={(event) => setForm((current) => ({ ...current, xaiCollectionId: event.target.value }))}
            placeholder="collection_…"
            value={form.xaiCollectionId}
          />
          {collectionsStatus ? (
            <p className="status-text status-error">{collectionsStatus}</p>
          ) : collections.length > 0 ? (
            <div className="stack-gap" style={{ maxHeight: "14rem", overflow: "auto" }}>
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Collection id</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name ?? "—"}</td>
                      <td>
                        <code className="status-text">{row.id}</code>
                      </td>
                      <td>
                        <div className="tool-row">
                          <button
                            className="tiny-button"
                            onClick={() => applyCollection(row)}
                            type="button"
                          >
                            Use
                          </button>
                          <button
                            className="tiny-button"
                            onClick={() => void copyCollectionId(row.id)}
                            type="button"
                          >
                            Copy id
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="status-text">No collections returned from xAI inventory.</p>
          )}
          <input
            onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            placeholder="model"
            required
            value={form.model}
          />
          <input
            onChange={(event) =>
              setForm((current) => ({ ...current, defaultScope: event.target.value }))
            }
            placeholder="default scope"
            required
            value={form.defaultScope}
          />

          <fieldset>
            <legend>Tools</legend>
            <label className="checkbox-label">
              <input
                checked={form.tools.web_search}
                onChange={() => toggleTool("web_search")}
                type="checkbox"
              />
              web_search
            </label>
            <label className="checkbox-label">
              <input
                checked={form.tools.x_search}
                onChange={() => toggleTool("x_search")}
                type="checkbox"
              />
              x_search
            </label>
            <label
              className={`checkbox-label${collectionSearchMissingCollection ? " status-error" : ""}`}
            >
              <input
                checked={form.tools.collection_search}
                onChange={() => toggleTool("collection_search")}
                type="checkbox"
              />
              collection_search (stored as collections_search → file_search at xAI)
              {collectionSearchMissingCollection ? (
                <small className="status-text status-error">requires linked collection id</small>
              ) : null}
            </label>
            <label className="checkbox-label">
              <input
                checked={form.tools.atxfinance}
                onChange={() => toggleTool("atxfinance")}
                type="checkbox"
              />
              atxfinance
              <small className="status-text">portfolio, watchlist, accounts, tasks</small>
            </label>
          </fieldset>

          <button className="tiny-button" onClick={() => setShowAdvanced((current) => !current)} type="button">
            {showAdvanced ? "Hide optional fields" : "Show optional fields"}
          </button>
          {showAdvanced ? (
            <>
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, xaiCollectionName: event.target.value }))
                }
                placeholder="collection display name"
                value={form.xaiCollectionName}
              />
              <input
                max={1}
                min={0}
                onChange={(event) =>
                  setForm((current) => ({ ...current, temperature: event.target.value }))
                }
                step="0.1"
                type="number"
                value={form.temperature}
              />
            </>
          ) : null}
          <select
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                xapiMode: event.target.value as PersonaPayload["xapiMode"]
              }))
            }
            value={form.xapiMode}
          >
            <option value="responses">xAPI mode: responses</option>
            <option value="chat_completions">xAPI mode: chat_completions</option>
          </select>
          <select
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                xapiToolChoice: event.target.value as PersonaPayload["xapiToolChoice"]
              }))
            }
            value={form.xapiToolChoice}
          >
            <option value="auto">tool_choice: auto</option>
            <option value="required">tool_choice: required</option>
            <option value="none">tool_choice: none</option>
          </select>
          <input
            max={10}
            min={1}
            onChange={(event) => setForm((current) => ({ ...current, xapiMaxTurns: event.target.value }))}
            step={1}
            type="number"
            value={form.xapiMaxTurns}
          />
          <label>
            <input
              checked={form.enableRag}
              onChange={(event) =>
                setForm((current) => ({ ...current, enableRag: event.target.checked }))
              }
              type="checkbox"
            />{" "}
            Enable RAG
          </label>
          <small className="status-text">
            Enable RAG means xchat can use collection/search context to ground answers before generating
            the final response.
          </small>
          <div className="tool-row">
            <button
              className="cta cta-primary"
              disabled={loading || collectionSearchMissingCollection}
              type="submit"
            >
              {mode === "create" ? "Create persona" : "Save persona"}
            </button>
            <button className="cta cta-secondary" onClick={() => router.push("/admin/personas")} type="button">
              Cancel
            </button>
            {mode === "edit" && personaId ? (
              <button
                className="cta cta-danger"
                disabled={loading}
                onClick={() => void onDelete()}
                type="button"
                aria-label="Delete persona"
              >
                <DeleteIcon className="crud-icon" /> Delete
              </button>
            ) : null}
          </div>
        </form>
      </article>
    </section>
  );
}
