"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./simple-persona-editor.module.css";

import { AddIcon, DeleteIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { isMultiAgentPersonaModelId } from "@/modules/xchat/multi-agent-persona-models";
import { collectionIdsDeclaredOnPersona } from "@/modules/xchat/persona-linked-collections";
import type { PersonaXapiConfig } from "@/modules/xchat/types";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

type SimplePersonaEditorProps = {
  mode: "create" | "edit";
  personaId?: string;
  /** From server `XAI_CHAT_MODEL` (create flow default). */
  defaultChatModelId?: string;
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
  citationsEnabled: boolean;
  keepXchatHistory: boolean;
};

type CollectionRow = {
  id: string;
  name?: string;
  stats: { documentCount: number | null; createdAt: string | null; updatedAt: string | null };
};

/** Values listed in the model &lt;select&gt;; personas may still carry other xAI ids from API. */
const PERSONA_MODEL_SELECT_IDS = new Set<string>([
  "grok-4-1-fast-reasoning",
  "grok-4-1",
  "grok-4.20-multi-agent"
]);

const EMPTY_FORM: PersonaPayload = {
  name: "",
  systemPrompt: `You are a helpful AI assistant. Be direct and accurate in your responses.`,
  overridePrompt: "",
  xaiCollectionId: "",
  xaiCollectionName: "",
  model: XAI_PERSONA_CHAT_MODEL_FALLBACK_ID,
  temperature: "0.2",
  enableRag: true,
  defaultScope: "global",
  citationsEnabled: true,
  keepXchatHistory: true
};

function initialPersonaFormForMode(
  mode: "create" | "edit",
  defaultChatModelId: string | undefined
): PersonaPayload {
  if (mode !== "create") {
    return EMPTY_FORM;
  }
  const fromEnv = defaultChatModelId?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return { ...EMPTY_FORM, model: fromEnv };
  }
  return EMPTY_FORM;
}

export function SimplePersonaEditor({
  mode,
  personaId,
  defaultChatModelId
}: SimplePersonaEditorProps) {
  const [form, setForm] = useState<PersonaPayload>(() =>
    initialPersonaFormForMode(mode, defaultChatModelId)
  );
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(mode === "edit");
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionFilter, setCollectionFilter] = useState("");
  const [collectionQuickPick, setCollectionQuickPick] = useState("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [showToolsPreview, setShowToolsPreview] = useState(false);
  const [includeHostedSearch, setIncludeHostedSearch] = useState(false);
  const router = useRouter();

  // Generate preview of tools JSON based on selected collections
  const previewToolsJson = useMemo(() => {
    const tools: Array<{ type: string; collection_ids?: string[] }> = [
      { type: "atx_function" },
      { type: "yahoo_finance" }
    ];

    // Add hosted search tools if enabled
    if (includeHostedSearch) {
      tools.push({ type: "web_search" });
      tools.push({ type: "x_search" });
    }

    // Add collections_search tool if collections are selected
    if (selectedCollectionIds.length > 0) {
      tools.push({
        type: "collections_search",
        collection_ids: selectedCollectionIds
      });
    }

    return tools;
  }, [selectedCollectionIds, includeHostedSearch]);

  const filteredCollections = useMemo(() => {
    const q = collectionFilter.trim().toLowerCase();
    if (!q) {
      return collections;
    }
    return collections.filter((row) => {
      const name = (row.name ?? "").toLowerCase();
      const id = row.id.toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [collections, collectionFilter]);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await parseJson<{ data: CollectionRow[] }>(
          await fetch("/api/personas/collections")
        );
        setCollections(payload.data);
      } catch (error) {
        console.warn("Could not load collections:", error);
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
            teamCollection?: { collectionId: string; collectionName?: string };
            model: string;
            temperature: number;
            enableRag: boolean;
            defaultScope: string;
            citationsEnabled?: boolean;
            keepXchatHistory?: boolean;
            xapi: PersonaXapiConfig;
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
          citationsEnabled: payload.data.citationsEnabled !== false,
          keepXchatHistory: payload.data.keepXchatHistory !== false,
        });
        const linkedIds = collectionIdsDeclaredOnPersona(
          {
            xaiCollection: payload.data.xaiCollection,
            teamCollection: payload.data.teamCollection
          },
          payload.data.xapi
        );
        setSelectedCollectionIds(linkedIds);

        // Check if hosted search tools are present
        const loadedTools = payload.data.xapi?.tools || [];
        const hasWebSearch = loadedTools.some(
          (tool: { type?: string }) => tool.type === "web_search"
        );
        const hasXSearch = loadedTools.some((tool: { type?: string }) => tool.type === "x_search");
        setIncludeHostedSearch(hasWebSearch && hasXSearch);

        setStatus("Loaded");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load persona");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, personaId]);

  const submitPersona = useCallback(
    async (event: FormEvent<HTMLFormElement> | null) => {
      event?.preventDefault();
      const parsedTemperature = Number(form.temperature.replace(",", ".").trim());
      if (!Number.isFinite(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 1) {
        setStatus("Temperature must be a number between 0 and 1");
        return;
      }

      setStatus(mode === "create" ? "Creating persona..." : "Saving persona...");
      try {
        const endpoint = mode === "create" ? "/api/personas" : `/api/personas/${personaId}`;
        const method = mode === "create" ? "POST" : "PUT";

        // Get the first selected collection
        const primaryCollectionId = selectedCollectionIds[0] || "";
        const primaryCollection = collections.find(c => c.id === primaryCollectionId);

        // Generate tools array based on selections
        const tools: Array<{ type: string; collection_ids?: string[] }> = [
          { type: "atx_function" },
          { type: "yahoo_finance" }
        ];

        // Add hosted search tools if enabled
        if (includeHostedSearch) {
          tools.push({ type: "web_search" });
          tools.push({ type: "x_search" });
        }

        // Add collections_search tool if collections are selected
        if (selectedCollectionIds.length > 0) {
          tools.push({
            type: "collections_search",
            collection_ids: selectedCollectionIds
          });
        }

        await parseJson(
          await fetch(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name,
              systemPrompt: form.systemPrompt,
              overridePrompt: form.overridePrompt,
              xaiCollection: {
                collectionId: primaryCollectionId,
                collectionName: primaryCollection?.name || ""
              },
              model: form.model,
              temperature: parsedTemperature,
              enableRag: form.enableRag,
              defaultScope: form.defaultScope,
              citationsEnabled: form.citationsEnabled,
              keepXchatHistory: form.keepXchatHistory,
              xapi: {
                mode: "responses",
                toolChoice: "auto",
                maxTurns: 5,
                tools: tools
              }
            })
          })
        );
        if (mode === "create") {
          router.push("/admin/personas");
          router.refresh();
          return;
        }
        setStatus("Changes saved.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to save persona");
      }
    },
    [form, mode, personaId, router, selectedCollectionIds, collections, includeHostedSearch]
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void submitPersona(event);
  }

  function toggleCollection(collectionId: string) {
    setSelectedCollectionIds((prev) => {
      const newIds = prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId];

      const firstId = newIds[0] || "";
      const firstCollection = collections.find((c) => c.id === firstId);
      setForm((current) => ({
        ...current,
        xaiCollectionId: firstId,
        xaiCollectionName: firstCollection?.name || ""
      }));

      return newIds;
    });
  }

  function appendCollectionFromQuickPick(collectionId: string) {
    if (!collectionId) {
      return;
    }
    setSelectedCollectionIds((prev) => {
      if (prev.includes(collectionId)) {
        return prev;
      }
      const newIds = [...prev, collectionId];
      const firstId = newIds[0] || "";
      const firstCollection = collections.find((c) => c.id === firstId);
      setForm((current) => ({
        ...current,
        xaiCollectionId: firstId,
        xaiCollectionName: firstCollection?.name || ""
      }));
      return newIds;
    });
    setCollectionQuickPick("");
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
          {/* Compact Settings */}
          <div className={styles.formSection}>
            <h4 className={styles.sectionHeader} style={{ marginBottom: "0.75rem" }}>
              Persona Settings
            </h4>

            <div className={styles.compactGrid}>
              <div>
                <label className="status-text" htmlFor="persona-name">
                  Name *
                </label>
                <input
                  id="persona-name"
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Financial Advisor"
                  required
                  value={form.name}
                  style={{ fontSize: "0.9rem", padding: "0.5rem" }}
                />
              </div>

              <div>
                <label className="status-text" htmlFor="persona-model">
                  AI Model *
                </label>
                <select
                  id="persona-model"
                  onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                  value={form.model}
                  style={{ fontSize: "0.9rem", padding: "0.5rem" }}
                >
                  {form.model.trim() && !PERSONA_MODEL_SELECT_IDS.has(form.model.trim()) ? (
                    <option value={form.model}>{form.model} (from persona)</option>
                  ) : null}
                  <option value="grok-4-1-fast-reasoning">Grok 4.1 Fast</option>
                  <option value="grok-4-1">Grok 4.1</option>
                  <option value="grok-4.20-multi-agent">Multi-Agent</option>
                </select>
              </div>

              <div>
                <label className="status-text" htmlFor="persona-temperature">
                  Temperature
                </label>
                <input
                  id="persona-temperature"
                  max={1}
                  min={0}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, temperature: event.target.value }))
                  }
                  step="0.1"
                  suppressHydrationWarning
                  type="number"
                  value={form.temperature}
                  style={{ fontSize: "0.9rem", padding: "0.5rem" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
              <label className={styles.checkboxRow}>
                <input
                  checked={form.enableRag}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, enableRag: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span style={{ fontSize: "0.9rem" }}>Enable RAG</span>
              </label>

              <label className={styles.checkboxRow}>
                <input
                  checked={form.citationsEnabled}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, citationsEnabled: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span style={{ fontSize: "0.9rem" }}>Citations</span>
              </label>

              <label className={styles.checkboxRow}>
                <input
                  checked={includeHostedSearch}
                  onChange={(event) => setIncludeHostedSearch(event.target.checked)}
                  type="checkbox"
                />
                <span style={{ fontSize: "0.9rem" }}>Web & X Search</span>
              </label>
            </div>

            {isMultiAgentPersonaModelId(form.model) && (
              <div className="status-warn" style={{ padding: "0.5rem", borderRadius: "4px", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                ⚠️ Multi-agent increases costs and response time
              </div>
            )}
          </div>

          {/* System Prompt */}
          <div className={styles.formSection}>
            <h4 className={styles.sectionHeader} style={{ marginBottom: "0.5rem" }}>
              System Prompt
            </h4>

            <label className="status-text" htmlFor="persona-system-prompt" style={{ fontSize: "0.9rem" }}>
              AI Instructions *
            </label>
            <textarea
              id="persona-system-prompt"
              onChange={(event) =>
                setForm((current) => ({ ...current, systemPrompt: event.target.value }))
              }
              placeholder="Describe how the AI should behave and respond..."
              required
              rows={4}
              value={form.systemPrompt}
              style={{ fontSize: "0.9rem" }}
            />
          </div>

          {/* Override Prompt */}
          <div className={styles.formSection}>
            <h4 className={styles.sectionHeader} style={{ marginBottom: "0.5rem" }}>
              Custom Instructions (Optional)
            </h4>

            <textarea
              id="persona-override-prompt"
              onChange={(event) =>
                setForm((current) => ({ ...current, overridePrompt: event.target.value }))
              }
              placeholder="Extra instructions added to every conversation..."
              rows={2}
              value={form.overridePrompt}
              style={{ fontSize: "0.9rem" }}
            />
          </div>

          {/* Collections */}
          <div className={styles.formSection}>
            <h4 className={styles.sectionHeader} style={{ marginBottom: "0.5rem" }}>
              Collections
            </h4>
            <p className={styles.collectionHint}>
              Choose which xAI collections feed <strong>collections_search</strong>. The{" "}
              <strong>first</strong> selected row is the primary binding (<code>xaiCollection</code> /
              file_search scope). Use checkboxes or the row; add extras with the dropdown.
            </p>

            {collections.length === 0 ? (
              <p className="status-text" style={{ opacity: 0.7 }}>
                No collections available. Create collections in xAI first.
              </p>
            ) : (
              <>
                <div className={styles.collectionToolbar}>
                  <div className={styles.collectionToolbarField}>
                    <label htmlFor="persona-collection-filter">Filter by name or id</label>
                    <input
                      id="persona-collection-filter"
                      className={styles.collectionSearchInput}
                      type="search"
                      autoComplete="off"
                      placeholder="Type to filter…"
                      value={collectionFilter}
                      onChange={(e) => setCollectionFilter(e.target.value)}
                    />
                  </div>
                  <div className={styles.collectionToolbarField}>
                    <label htmlFor="persona-collection-quick-pick">Add from list</label>
                    <select
                      id="persona-collection-quick-pick"
                      className={styles.collectionQuickSelect}
                      aria-label="Add a collection to the RAG selection"
                      value={collectionQuickPick}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          appendCollectionFromQuickPick(v);
                        }
                      }}
                    >
                      <option value="">— Select a collection to add —</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {(c.name?.trim() || "Unnamed")} · {c.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.collectionTableWrap} role="region" aria-label="xAI collections list">
                  <table className={styles.collectionTable}>
                    <thead>
                      <tr>
                        <th className={styles.collectionCheckCell} scope="col">
                          On
                        </th>
                        <th scope="col">Name</th>
                        <th scope="col">Collection id</th>
                        <th className={styles.collectionDocsCell} scope="col">
                          Docs
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCollections.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <span className="status-text" style={{ opacity: 0.75 }}>
                              No collections match this filter.
                            </span>
                          </td>
                        </tr>
                      ) : (
                        filteredCollections.map((collection) => {
                          const isSelected = selectedCollectionIds.includes(collection.id);
                          const docCount =
                            collection.stats.documentCount == null
                              ? "—"
                              : String(collection.stats.documentCount);
                          return (
                            <tr
                              key={collection.id}
                              className={isSelected ? styles.collectionRowSelected : undefined}
                              onClick={() => toggleCollection(collection.id)}
                            >
                              <td
                                className={styles.collectionCheckCell}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCollection(collection.id)}
                                  aria-label={`Use collection ${collection.name || collection.id} for RAG`}
                                />
                              </td>
                              <td className={styles.collectionNameCell}>
                                {collection.name?.trim() || "Unnamed collection"}
                              </td>
                              <td className={styles.collectionIdCell} title={collection.id}>
                                {collection.id}
                              </td>
                              <td className={styles.collectionDocsCell}>{docCount}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {selectedCollectionIds.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <p className={styles.statusText} style={{ fontSize: "0.85rem" }}>
                    <strong>Selected:</strong> {selectedCollectionIds.length} collection{selectedCollectionIds.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowToolsPreview(!showToolsPreview)}
                    className="cta cta-secondary"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                  >
                    {showToolsPreview ? 'Hide' : 'Show'} Tools Preview
                  </button>
                </div>

                {showToolsPreview && (
                  <div style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                    padding: "0.75rem",
                    marginTop: "0.5rem"
                  }}>
                    <div style={{ marginBottom: "0.5rem" }}>
                      <strong className={styles.statusText} style={{ fontSize: "0.8rem" }}>
                        Collection IDs:
                      </strong>
                      <code style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "3px",
                        marginLeft: "0.5rem",
                        fontSize: "0.75rem"
                      }}>
                        {selectedCollectionIds.join(", ")}
                      </code>
                    </div>

                    <div>
                      <strong className={styles.statusText} style={{ fontSize: "0.8rem", marginBottom: "0.25rem", display: "block" }}>
                        Generated Tools JSON:
                      </strong>
                      <pre style={{
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "4px",
                        padding: "0.5rem",
                        fontSize: "0.7rem",
                        overflow: "auto",
                        maxHeight: "200px"
                      }}>
                        {JSON.stringify(previewToolsJson, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className={styles.toolRow} style={{ marginTop: "1.5rem" }}>
            <button
              aria-label={mode === "create" ? "Create persona" : "Save persona changes"}
              className="cta cta-primary"
              disabled={loading}
              title={mode === "create" ? "Create this persona" : "Save persona changes"}
              type="submit"
            >
              {mode === "create" ? (
                <>
                  <AddIcon className="crud-icon" /> Create Persona
                </>
              ) : (
                <>
                  <SaveIcon className="crud-icon" /> Save Changes
                </>
              )}
            </button>
            <button
              aria-label="Back to personas"
              className="cta cta-secondary"
              onClick={() => router.push("/admin/personas")}
              title="Back to personas list without saving"
              type="button"
            >
              Back to Personas
            </button>
            {mode === "edit" && personaId && (
              <button
                className="cta cta-danger"
                disabled={loading}
                onClick={() => void onDelete()}
                type="button"
                aria-label="Delete persona"
                title="Delete persona permanently"
              >
                <DeleteIcon className="crud-icon" /> Delete Persona
              </button>
            )}
          </div>
        </form>
      </article>

    </section>
  );
}