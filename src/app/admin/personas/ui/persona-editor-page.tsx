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
import { isMultiAgentPersonaModelId } from "@/modules/xchat/multi-agent-persona-models";
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
  citationsEnabled: boolean;
  keepXchatHistory: boolean;
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
  /** Daily xChat default: fast single-pass (matches server fallback when env unset). */
  model: XAI_PERSONA_CHAT_MODEL_FALLBACK_ID,
  temperature: "0.2",
  enableRag: true,
  defaultScope: "global",
  xapiMode: "responses",
  xapiToolChoice: "auto",
  xapiMaxTurns: "5",
  xapiToolsJson: DEFAULT_XPERSONA_TOOLS_JSON,
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

const PERSONA_EDITOR_TABS = [
  { id: "general", label: "General" },
  { id: "prompts", label: "Prompts" },
  { id: "rag", label: "RAG & collections" },
  { id: "xapi", label: "Tools & xAPI" }
] as const;

type PersonaEditorTabId = (typeof PERSONA_EDITOR_TABS)[number]["id"];

export function PersonaEditorPage({
  mode,
  personaId,
  defaultChatModelId
}: PersonaEditorPageProps) {
  const [form, setForm] = useState<PersonaPayload>(() =>
    initialPersonaFormForMode(mode, defaultChatModelId)
  );
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(mode === "edit");
  const [editorTab, setEditorTab] = useState<PersonaEditorTabId>("general");
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
            citationsEnabled?: boolean;
            keepXchatHistory?: boolean;
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
          citationsEnabled: payload.data.citationsEnabled !== false,
          keepXchatHistory: payload.data.keepXchatHistory !== false,
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
              citationsEnabled: form.citationsEnabled,
              keepXchatHistory: form.keepXchatHistory,
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
    [
      form,
      includeHostedSearchInTools,
      mode,
      personaId,
      restrictCollectionScope,
      router,
      selectedCollectionIds
    ]
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
          <div className="persona-editor__tabs" role="tablist" aria-label="Persona editor sections">
            {PERSONA_EDITOR_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`persona-editor-tab-${tab.id}`}
                aria-controls={`persona-editor-panel-${tab.id}`}
                aria-selected={editorTab === tab.id}
                className="persona-editor__tab"
                onClick={() => setEditorTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            className="persona-editor__panel"
            hidden={editorTab !== "general"}
            id="persona-editor-panel-general"
            role="tabpanel"
            aria-labelledby="persona-editor-tab-general"
          >
              <input
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Persona name"
                required
                value={form.name}
              />
              <PersonaModelSelect
                onChange={(modelId) => setForm((current) => ({ ...current, model: modelId }))}
                required
                value={form.model}
              />
              <p className="status-text" style={{ fontSize: "0.8rem", lineHeight: 1.45, margin: "-0.15rem 0 0" }}>
                <strong>Daily xChat:</strong> keep a <strong>fast single-pass</strong> model (e.g.{" "}
                <code>grok-4-1-fast-reasoning</code>) — same as create default. Server routing is already{" "}
                <strong>retrieval-first → selective tools → multi-agent only when synthesis truly needs it</strong>.
                Forcing <code>grok-4.20-multi-agent</code> on the persona spikes cost/latency for normal questions.
              </p>
              {isMultiAgentPersonaModelId(form.model) ? (
                <div
                  className="status-text status-warn"
                  role="alert"
                  style={{
                    fontSize: "0.82rem",
                    lineHeight: 1.45,
                    borderLeft: "3px solid var(--xf-lightning-yellow, #eab308)",
                    paddingLeft: "0.65rem",
                    marginTop: "0.15rem"
                  }}
                >
                  <strong>Not recommended for normal personas.</strong>{" "}
                  <code>grok-4.20-multi-agent</code> is the parallel-agent engine for{" "}
                  <strong>heavy synthesis</strong> and <strong>xStrategyBuilder / strategy-job finalizer</strong>{" "}
                  (backend), not watchlist/quote/portfolio banter. xChat will often{" "}
                  <strong>downgrade</strong> to the fast model on typical turns anyway; the rail shows the effective
                  model. Prefer fast model here; policy:{" "}
                  <code>atx-docs/xchat/context-routing-multi-agent-policy.md</code>.
                </div>
              ) : null}
              <div className="persona-editor__general-grid">
                <div>
                  <label className="status-text" htmlFor="persona-default-scope">
                    Default scope
                  </label>
                  <input
                    id="persona-default-scope"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, defaultScope: event.target.value }))
                    }
                    placeholder="global"
                    required
                    value={form.defaultScope}
                  />
                </div>
                <div>
                  <label className="status-text" htmlFor="persona-temperature">
                    Temperature (0–1)
                  </label>
                  <input
                    id="persona-temperature"
                    max={1}
                    min={0}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, temperature: event.target.value }))
                    }
                    step="0.1"
                    type="number"
                    value={form.temperature}
                  />
                </div>
              </div>
              <div>
                <label className="status-text" htmlFor="persona-collection-display-name">
                  Collection display name (optional)
                </label>
                <input
                  id="persona-collection-display-name"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, xaiCollectionName: event.target.value }))
                  }
                  placeholder="Friendly label for linked collection"
                  value={form.xaiCollectionName}
                />
              </div>
              <div className="persona-editor__checkbox-row">
                <label className="status-text" style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start" }}>
                  <input
                    checked={form.enableRag}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, enableRag: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>Enable RAG</strong> — pre-search team KB before the model responds.
                  </span>
                </label>
                <label className="status-text" style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start" }}>
                  <input
                    checked={form.citationsEnabled}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, citationsEnabled: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>Citation chips</strong> — [@citation:…] contract in system prompt.
                  </span>
                </label>
                <label className="status-text" style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start" }}>
                  <input
                    checked={form.keepXchatHistory}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, keepXchatHistory: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>Remote xChat history</strong> — <code>previous_response_id</code> when env enables it.
                  </span>
                </label>
              </div>
          </div>

          <div
            className="persona-editor__panel"
            hidden={editorTab !== "prompts"}
            id="persona-editor-panel-prompts"
            role="tabpanel"
            aria-labelledby="persona-editor-tab-prompts"
          >
              <label className="status-text" htmlFor="persona-system-prompt">
                System prompt (xAI instructions)
              </label>
              <textarea
                id="persona-system-prompt"
                onChange={(event) =>
                  setForm((current) => ({ ...current, systemPrompt: event.target.value }))
                }
                placeholder="System prompt (sent as chat system message)"
                required
                rows={5}
                value={form.systemPrompt}
              />
              <label className="status-text" htmlFor="persona-override-prompt">
                Override prompt (prepended to each user turn)
              </label>
              <textarea
                id="persona-override-prompt"
                onChange={(event) =>
                  setForm((current) => ({ ...current, overridePrompt: event.target.value }))
                }
                placeholder="Optional — prepended to each user message for xChat"
                rows={3}
                value={form.overridePrompt}
              />
          </div>

          <div
            className="persona-editor__panel"
            hidden={editorTab !== "rag"}
            id="persona-editor-panel-rag"
            role="tabpanel"
            aria-labelledby="persona-editor-tab-rag"
          >
              <label className="status-text">Linked collections (RAG / KB scope for xChat)</label>
              <label
                className="status-text"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "-0.15rem" }}
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
                <span>Restrict access to specific collections</span>
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
                      Selected: <code>{selectedCollectionIds.join(", ")}</code>
                    </>
                  ) : restrictCollectionScope ? (
                    "Choose one or more collections from the list."
                  ) : (
                    "Restriction off — persona uses default collection scope from tools / deploy defaults."
                  )}
                </p>
              ) : (
                <p className="status-text">No collections returned from xAI inventory.</p>
              )}
          </div>

          <div
            className="persona-editor__panel"
            hidden={editorTab !== "xapi"}
            id="persona-editor-panel-xapi"
            role="tabpanel"
            aria-labelledby="persona-editor-tab-xapi"
          >
              <div
                className="status-text"
                role="region"
                aria-label="Recommended production defaults"
                style={{
                  fontSize: "0.8rem",
                  lineHeight: 1.45,
                  border: "1px solid rgba(57, 255, 20, 0.25)",
                  borderRadius: 8,
                  padding: "0.65rem 0.75rem",
                  background: "rgba(57, 255, 20, 0.06)"
                }}
              >
                <strong style={{ color: "var(--xf-text-100)" }}>Lock these for daily xChat</strong>
                <table
                  className="status-text"
                  style={{
                    width: "100%",
                    marginTop: "0.45rem",
                    borderCollapse: "collapse",
                    fontSize: "0.78rem"
                  }}
                >
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                      <th style={{ padding: "0.25rem 0.4rem 0.35rem 0" }}>Setting</th>
                      <th style={{ padding: "0.25rem 0.4rem" }}>Value</th>
                      <th style={{ padding: "0.25rem 0 0.35rem 0.4rem" }}>When it changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "0.35rem 0.4rem 0.35rem 0", verticalAlign: "top" }}>Persona model</td>
                      <td style={{ padding: "0.35rem 0.4rem", verticalAlign: "top" }}>
                        <code>grok-4-1-fast-reasoning</code> (or server default)
                      </td>
                      <td style={{ padding: "0.35rem 0 0.35rem 0.4rem", verticalAlign: "top" }}>
                        Never multi-agent for normal personas
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "0.35rem 0.4rem 0.35rem 0", verticalAlign: "top" }}>Tool choice</td>
                      <td style={{ padding: "0.35rem 0.4rem", verticalAlign: "top" }}>
                        <code>auto</code>
                      </td>
                      <td style={{ padding: "0.35rem 0 0.35rem 0.4rem", verticalAlign: "top" }}>Keep</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "0.35rem 0.4rem 0.35rem 0", verticalAlign: "top" }}>xAPI mode / turns / RAG</td>
                      <td style={{ padding: "0.35rem 0.4rem", verticalAlign: "top" }}>
                        <code>responses</code> · <code>5</code> turns · RAG on
                      </td>
                      <td style={{ padding: "0.35rem 0 0.35rem 0.4rem", verticalAlign: "top" }}>Keep</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0.35rem 0.4rem 0.2rem 0", verticalAlign: "top" }}>Multi-agent model</td>
                      <td style={{ padding: "0.35rem 0.4rem", verticalAlign: "top" }}>
                        <code>grok-4.20-multi-agent</code>
                      </td>
                      <td style={{ padding: "0.35rem 0 0.2rem 0.4rem", verticalAlign: "top" }}>
                        Strategy-job / orchestrator finalizer (backend), not persona default
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <label className="status-text" htmlFor="persona-xapi-tools-json">
                xAPI tools (JSON array) — <code>web_search</code>, <code>x_search</code>,{" "}
                <code>code_interpreter</code>, <code>collections_search</code>, <code>yahoo_finance</code>,{" "}
                <code>atx_function</code>
              </label>
              <textarea
                id="persona-xapi-tools-json"
                onChange={(event) =>
                  setForm((current) => ({ ...current, xapiToolsJson: event.target.value }))
                }
                placeholder='[{"type":"web_search"}, …]'
                rows={10}
                spellCheck={false}
                value={form.xapiToolsJson}
              />

              <fieldset
                className="stack-gap"
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 8,
                  padding: "0.75rem 1rem",
                  marginTop: "0.15rem"
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
                    On save, prepend <code>web_search</code> and <code>x_search</code> if missing (recommended).
                  </span>
                </label>
                <div
                  className="status-text"
                  role="note"
                  style={{
                    fontSize: "0.85rem",
                    borderLeft: "3px solid var(--xf-gain-green)",
                    paddingLeft: "0.65rem",
                    marginTop: "0.25rem",
                    opacity: 0.95
                  }}
                >
                  Prefer <code>web_search</code>, <code>x_search</code>, and usually <code>atx_function</code> when the
                  persona needs live or workspace data.
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
                      Parsed tools are empty and hosted-search merge is off.
                    </p>
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

              <div className="persona-editor__general-grid">
                <div>
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
                </div>
                <div>
                  <label className="status-text" htmlFor="persona-xapi-max-turns">
                    Max tool turns
                  </label>
                  <input
                    id="persona-xapi-max-turns"
                    max={10}
                    min={1}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, xapiMaxTurns: event.target.value }))
                    }
                    step={1}
                    type="number"
                    value={form.xapiMaxTurns}
                  />
                </div>
              </div>
              <div>
                <label className="status-text" htmlFor="persona-xapi-tool-choice">
                  Tool choice (xAI Responses)
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
                  <option value="required">required — must call a tool first</option>
                  <option value="none">none — tool_choice none (usually no tool calls)</option>
                </select>
                <small className="status-text" style={{ display: "block", marginTop: "0.35rem", lineHeight: 1.4 }}>
                  Does <strong>not</strong> change the text of user messages. It only sets the provider&apos;s{" "}
                  <code>tool_choice</code>: <strong>auto</strong> allows tool calls; <strong>none</strong> discourages
                  them (text-first); <strong>required</strong> forces a tool invocation. Prompt assembly (system +
                  override + KB) is unchanged.
                </small>
              </div>
          </div>

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
