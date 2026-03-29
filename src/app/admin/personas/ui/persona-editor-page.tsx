"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { PersonaModelSelect } from "@/app/admin/personas/ui/persona-model-select";
import {
    DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT,
    DEFAULT_XPERSONA_TOOLS_JSON,
    mergeHostedSearchIntoPersonaTools,
    parsePersonaXapiToolsJson,
    personaToolsIncludeHostedSearch
} from "@/app/admin/personas/ui/personas-onboarding";
import { AddIcon, DeleteIcon, SaveIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

type PersonaEditorPageProps = {
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
  xapiMode: "responses" | "chat_completions";
  xapiToolChoice: "auto" | "required" | "none";
  xapiMaxTurns: string;
  xapiToolsJson: string;
};

type CollectionRow = {
  id: string;
  name?: string;
  stats: { documentCount: number | null; createdAt: string | null; updatedAt: string | null };
};

type CollectionToolShape = { type: string; [key: string]: unknown };

const EMPTY_FORM: PersonaPayload = {
  name: "",
  systemPrompt: DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT,
  overridePrompt: "",
  xaiCollectionId: "",
  xaiCollectionName: "",
  model: XAI_PERSONA_CHAT_MODEL_FALLBACK_ID,
  temperature: "0.2",
  enableRag: true,
  defaultScope: "global",
  xapiMode: "responses",
  xapiToolChoice: "auto",
  xapiMaxTurns: "5",
  xapiToolsJson: DEFAULT_XPERSONA_TOOLS_JSON
};

export function PersonaEditorPage({ mode, personaId }: PersonaEditorPageProps) {
  const [form, setForm] = useState<PersonaPayload>(EMPTY_FORM);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(mode === "edit");
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionsStatus, setCollectionsStatus] = useState<string | null>(null);
  const [restrictCollectionScope, setRestrictCollectionScope] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState("");
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  /** When true, save merges `web_search` + `x_search` into the tools array if missing. */
  const [includeHostedSearchInTools, setIncludeHostedSearchInTools] = useState(false);
  const [showEmptyToolsGuard, setShowEmptyToolsGuard] = useState(false);
  const router = useRouter();

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
        const loadedTools = payload.data.xapi.tools ?? [];
        const toolCollectionIds = extractCollectionIdsFromTools(loadedTools);
        const fallbackCollectionId = payload.data.xaiCollection.collectionId?.trim() ?? "";
        const selectedIds =
          toolCollectionIds.length > 0
            ? toolCollectionIds
            : fallbackCollectionId
              ? [fallbackCollectionId]
              : [];
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
          xapiToolsJson: JSON.stringify(loadedTools, null, 2)
        });
        setSelectedCollectionIds(selectedIds);
        setRestrictCollectionScope(selectedIds.length > 0);
        setIncludeHostedSearchInTools(personaToolsIncludeHostedSearch(loadedTools));
        setShowEmptyToolsGuard(false);
        setStatus("Loaded");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load persona");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, personaId]);

  const submitPersona = useCallback(
    async (event: FormEvent<HTMLFormElement> | null, allowEmptyTools: boolean) => {
      event?.preventDefault();
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
      if (restrictCollectionScope && selectedCollectionIds.length === 0) {
        setStatus("Select a collection or disable restrict access.");
        return;
      }
      let parsedTools: Array<{ type: string; [key: string]: unknown }>;
      try {
        parsedTools = parsePersonaXapiToolsJson(form.xapiToolsJson);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Invalid tools JSON");
        return;
      }
      const hasAnyEffectiveTools = parsedTools.length > 0 || includeHostedSearchInTools;
      if (!hasAnyEffectiveTools && !allowEmptyTools) {
        setShowEmptyToolsGuard(true);
        setStatus("Blocked: tools JSON is empty and hosted search merge is off.");
        return;
      }
      setShowEmptyToolsGuard(false);
      const toolsToSend = includeHostedSearchInTools
        ? mergeHostedSearchIntoPersonaTools(parsedTools)
        : parsedTools;
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
                tools: toolsToSend
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
    [form, includeHostedSearchInTools, mode, personaId, restrictCollectionScope, router, selectedCollectionIds]
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void submitPersona(event, false);
  }

  const visibleCollections = useMemo(() => {
    const query = collectionFilter.trim().toLowerCase();
    if (!query) {
      return collections;
    }
    return collections.filter((row) => {
      const name = row.name?.trim().toLowerCase() ?? "";
      const id = row.id.toLowerCase();
      return name.includes(query) || id.includes(query);
    });
  }, [collectionFilter, collections]);

  function applySelectedCollectionIds(nextIdsInput: string[]) {
    const nextIds = Array.from(new Set(nextIdsInput.map((id) => id.trim()).filter(Boolean)));
    const syncResult = synchronizeCollectionIdsInToolsJson(form.xapiToolsJson, nextIds);
    if (!syncResult.ok) {
      setStatus(syncResult.message);
      return;
    }
    const firstCollectionId = nextIds[0] ?? "";
    const firstCollectionName =
      firstCollectionId.length > 0
        ? collections.find((row) => row.id === firstCollectionId)?.name ?? ""
        : "";
    setSelectedCollectionIds(nextIds);
    setForm((current) => ({
      ...current,
      xaiCollectionId: firstCollectionId,
      xaiCollectionName: firstCollectionId ? firstCollectionName : "",
      xapiToolsJson: syncResult.value
    }));
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
          <label className="status-text">Linked collection id (RAG / KB scope for xChat)</label>
          <label
            className="status-text"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "-0.2rem" }}
          >
            <input
              checked={restrictCollectionScope}
              onChange={(event) => {
                const checked = event.target.checked;
                setRestrictCollectionScope(checked);
                if (!checked) {
                  applySelectedCollectionIds([]);
                } else {
                  const existingIds = extractCollectionIdsFromToolsJson(form.xapiToolsJson);
                  if (existingIds.length > 0) {
                    setSelectedCollectionIds(existingIds);
                  }
                }
              }}
              type="checkbox"
            />
            <span>Restrict access to a specific collection</span>
          </label>
          {restrictCollectionScope ? (
            <>
              <input
                onChange={(event) => setCollectionFilter(event.target.value)}
                placeholder="Search by collection name or id"
                value={collectionFilter}
              />
              <div
                className="stack-gap"
                style={{
                  maxHeight: "14rem",
                  overflow: "auto",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 8,
                  padding: "0.55rem 0.7rem"
                }}
              >
                {visibleCollections.length > 0 ? (
                  visibleCollections.map((row) => {
                    const displayName = row.name?.trim() || "Unnamed collection";
                    const selected = selectedCollectionIds.includes(row.id);
                    return (
                      <label
                        key={row.id}
                        className="status-text"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.1rem 1fr",
                          alignItems: "start",
                          gap: "0.5rem"
                        }}
                      >
                        <input
                          checked={selected}
                          onChange={(event) => {
                            const nextIds = event.target.checked
                              ? [...selectedCollectionIds, row.id]
                              : selectedCollectionIds.filter((id) => id !== row.id);
                            applySelectedCollectionIds(nextIds);
                          }}
                          type="checkbox"
                          value={row.id}
                        />
                        <span>
                          {displayName}
                          <br />
                          <code>{row.id}</code>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="status-text" style={{ margin: 0 }}>
                    No collections match <code>{collectionFilter.trim()}</code>
                  </p>
                )}
              </div>
            </>
          ) : null}
          {collectionsStatus ? (
            <p className="status-text status-error">{collectionsStatus}</p>
          ) : collections.length > 0 ? (
            <p className="status-text">
              {restrictCollectionScope && selectedCollectionIds.length > 0 ? (
                <>
                  Selected:{" "}
                  <code>{selectedCollectionIds.join(", ")}</code>
                </>
              ) : restrictCollectionScope ? (
                "Choose one or more collections from the list."
              ) : (
                "Collection restriction disabled (persona can use default collection scope)."
              )}
            </p>
          ) : (
            <p className="status-text">No collections returned from xAI inventory.</p>
          )}
          <PersonaModelSelect
            onChange={(modelId) => setForm((current) => ({ ...current, model: modelId }))}
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

          <label className="status-text" htmlFor="persona-xapi-tools-json">
            xAPI tools (JSON array) — supports hosted tools like web_search, x_search, code_interpreter,
            collections_search, plus yahoo_finance and atx_function
          </label>
          <textarea
            id="persona-xapi-tools-json"
            onChange={(event) =>
              setForm((current) => ({ ...current, xapiToolsJson: event.target.value }))
            }
            placeholder='[{"type":"web_search"}, …]'
            rows={12}
            spellCheck={false}
            value={form.xapiToolsJson}
          />

          <fieldset
            className="stack-gap"
            style={{
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              marginTop: "0.35rem"
            }}
          >
            <legend className="status-text" style={{ padding: "0 0.35rem" }}>
              Tools guardrails
            </legend>
            <label className="status-text" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                checked={includeHostedSearchInTools}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setIncludeHostedSearchInTools(checked);
                  if (checked) {
                    setShowEmptyToolsGuard(false);
                  }
                }}
                type="checkbox"
              />
              <span>
                On save, prepend <code>web_search</code> and <code>x_search</code> if they are missing (recommended).
                Keep this off if you want strict admin-controlled tool ordering; enable only when you want automatic
                hosted-search insertion.
              </span>
            </label>
            <div
              className="status-text"
              role="note"
              style={{
                fontSize: "0.88rem",
                borderLeft: "3px solid rgba(0, 200, 120, 0.45)",
                paddingLeft: "0.65rem",
                marginTop: "0.35rem"
              }}
            >
              Prefer a non-empty tools array with <code>web_search</code>, <code>x_search</code>, and usually{" "}
              <code>atx_function</code> (plus RAG / Yahoo as needed). Saving with no tools and merge off can break live
              search expectations and trigger provider errors.
            </div>
            {showEmptyToolsGuard ? (
              <div
                className="status-text status-error"
                role="alert"
                style={{
                  border: "1px solid rgba(220, 80, 80, 0.45)",
                  borderRadius: 6,
                  padding: "0.65rem 0.85rem",
                  marginTop: "0.5rem"
                }}
              >
                <strong>Empty tools configuration</strong>
                <p style={{ margin: "0.45rem 0 0.35rem" }}>
                  Parsed tools are empty and hosted-search merge is off. The model may skip live data, invent tool
                  names, or return unreliable market context.
                </p>
                <ul style={{ margin: "0.25rem 0 0.5rem", paddingLeft: "1.1rem" }}>
                  <li>Real-time web / X grounding may not run</li>
                  <li>Bad tool JSON → xAI 422 errors</li>
                  <li>Stale or hallucinated financial answers</li>
                </ul>
                <div className="tool-row" style={{ marginTop: "0.65rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button
                    className="tiny-button"
                    type="button"
                    onClick={() => {
                      setIncludeHostedSearchInTools(true);
                      setShowEmptyToolsGuard(false);
                      setStatus("Hosted search merge enabled — click Save again.");
                    }}
                  >
                    Enable hosted search merge
                  </button>
                  <button
                    className="cta cta-danger"
                    type="button"
                    onClick={() => void submitPersona(null, true)}
                  >
                    Save anyway (not recommended)
                  </button>
                </div>
              </div>
            ) : null}
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
          <label className="status-text" htmlFor="persona-xapi-mode">
            xAPI mode
          </label>
          <select
            id="persona-xapi-mode"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                xapiMode: event.target.value as PersonaPayload["xapiMode"]
              }))
            }
            value={form.xapiMode}
          >
            <option value="responses">responses</option>
            <option value="chat_completions">chat_completions</option>
          </select>
          <label className="status-text" htmlFor="persona-xapi-tool-choice">
            Tool choice (xAI)
          </label>
          <select
            id="persona-xapi-tool-choice"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                xapiToolChoice: event.target.value as PersonaPayload["xapiToolChoice"]
              }))
            }
            value={form.xapiToolChoice}
          >
            <option value="auto">auto — model may call tools</option>
            <option value="required">required — must call a tool</option>
            <option value="none">none — no tools</option>
          </select>
          <label className="status-text" htmlFor="persona-xapi-max-turns">
            Max tool turns
          </label>
          <input
            id="persona-xapi-max-turns"
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
              aria-label={mode === "create" ? "Create persona" : "Save persona changes"}
              className="cta cta-primary"
              disabled={loading}
              title={mode === "create" ? "Create this persona" : "Save persona changes"}
              type="submit"
            >
              {mode === "create" ? (
                <>
                  <AddIcon className="crud-icon" /> Create persona
                </>
              ) : (
                <>
                  <SaveIcon className="crud-icon" /> Save changes
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
              Back to personas
            </button>
            {mode === "edit" && personaId ? (
              <button
                className="cta cta-danger"
                disabled={loading}
                onClick={() => void onDelete()}
                type="button"
                aria-label="Delete persona"
                title="Delete persona permanently"
              >
                <DeleteIcon className="crud-icon" /> Delete persona
              </button>
            ) : null}
          </div>
        </form>
      </article>
    </section>
  );
}

function extractCollectionIdsFromTools(
  tools: Array<{ type: string; [key: string]: unknown }>
): string[] {
  const ids: string[] = [];
  for (const tool of tools) {
    if (tool.type === "collections_search" && Array.isArray(tool.collection_ids)) {
      for (const id of tool.collection_ids) {
        if (typeof id === "string" && id.trim().length > 0) {
          ids.push(id.trim());
        }
      }
    }
  }
  return Array.from(new Set(ids));
}

function extractCollectionIdsFromToolsJson(toolsJson: string): string[] {
  try {
    const parsed = parsePersonaXapiToolsJson(toolsJson);
    return extractCollectionIdsFromTools(parsed);
  } catch {
    return [];
  }
}

function synchronizeCollectionIdsInToolsJson(
  toolsJson: string,
  selectedIdsInput: string[]
): { ok: true; value: string } | { ok: false; message: string } {
  let parsedTools: CollectionToolShape[];
  try {
    parsedTools = parsePersonaXapiToolsJson(toolsJson);
  } catch {
    return { ok: false, message: "Tools JSON is invalid. Fix JSON before changing collection selections." };
  }
  const selectedIds = Array.from(new Set(selectedIdsInput.map((id) => id.trim()).filter(Boolean)));
  const nextTools = parsedTools.map((tool) =>
    tool.type === "collections_search" ? { ...tool, collection_ids: selectedIds } : { ...tool }
  );
  if (!nextTools.some((tool) => tool.type === "collections_search") && selectedIds.length > 0) {
    const atxIndex = nextTools.findIndex((tool) => tool.type === "atx_function");
    const collectionTool: CollectionToolShape = { type: "collections_search", collection_ids: selectedIds };
    if (atxIndex >= 0) {
      nextTools.splice(atxIndex + 1, 0, collectionTool);
    } else {
      nextTools.push(collectionTool);
    }
  }
  return { ok: true, value: JSON.stringify(nextTools, null, 2) };
}
