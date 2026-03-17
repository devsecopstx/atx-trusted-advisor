"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { parseJson } from "@/app/admin/ui/http";
import { DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT } from "@/app/admin/personas/ui/personas-onboarding";

type PersonaEditorPageProps = {
  mode: "create" | "edit";
  personaId?: string;
};

type ToolSelections = {
  web_search: boolean;
  x_search: boolean;
  file_search: boolean;
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

const EMPTY_FORM: PersonaPayload = {
  name: "",
  systemPrompt: DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT,
  overridePrompt: "",
  xaiCollectionId: "",
  xaiCollectionName: "",
  model: "grok-4-1-fast",
  temperature: "0.2",
  enableRag: true,
  defaultScope: "global",
  xapiMode: "responses",
  xapiToolChoice: "auto",
  xapiMaxTurns: "5",
  tools: { web_search: true, x_search: false, file_search: false }
};

function toolSelectionsFromArray(
  tools: Array<{ type: string; [key: string]: unknown }>
): ToolSelections {
  return {
    web_search: tools.some((t) => t.type === "web_search"),
    x_search: tools.some((t) => t.type === "x_search"),
    file_search: tools.some((t) => t.type === "file_search")
  };
}

function toolSelectionsToArray(
  selections: ToolSelections,
  collectionId: string
): Array<{ type: string; [key: string]: unknown }> {
  const tools: Array<{ type: string; [key: string]: unknown }> = [];
  if (selections.web_search) tools.push({ type: "web_search" });
  if (selections.x_search) tools.push({ type: "x_search" });
  if (selections.file_search) {
    const boundId = collectionId.trim();
    tools.push(
      boundId
        ? { type: "file_search", source: { collection_ids: [boundId] } }
        : { type: "file_search" }
    );
  }
  return tools;
}

export function PersonaEditorPage({ mode, personaId }: PersonaEditorPageProps) {
  const [form, setForm] = useState<PersonaPayload>(EMPTY_FORM);
  const [status, setStatus] = useState("Ready");
  const [loading, setLoading] = useState(mode === "edit");
  const [showAdvanced, setShowAdvanced] = useState(mode === "edit");
  const router = useRouter();

  const fileSearchMissingCollection =
    form.tools.file_search && !form.xaiCollectionId.trim();

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
    if (fileSearchMissingCollection) {
      setStatus("file_search requires a collection id. Link a collection or deselect file_search.");
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
            placeholder="system prompt"
            required
            rows={6}
            value={form.systemPrompt}
          />
          <input
            onChange={(event) => setForm((current) => ({ ...current, xaiCollectionId: event.target.value }))}
            placeholder="collection id"
            value={form.xaiCollectionId}
          />
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
            <label className={`checkbox-label${fileSearchMissingCollection ? " status-error" : ""}`}>
              <input
                checked={form.tools.file_search}
                onChange={() => toggleTool("file_search")}
                type="checkbox"
              />
              file_search
              {fileSearchMissingCollection ? (
                <small className="status-text status-error">
                  requires collection id
                </small>
              ) : null}
            </label>
          </fieldset>

          <button className="tiny-button" onClick={() => setShowAdvanced((current) => !current)} type="button">
            {showAdvanced ? "Hide optional fields" : "Show optional fields"}
          </button>
          {showAdvanced ? (
            <>
              <textarea
                onChange={(event) =>
                  setForm((current) => ({ ...current, overridePrompt: event.target.value }))
                }
                placeholder="override prompt"
                rows={4}
                value={form.overridePrompt}
              />
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, xaiCollectionName: event.target.value }))
                }
                placeholder="collection name"
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
            <button className="cta cta-primary" disabled={loading || fileSearchMissingCollection} type="submit">
              {mode === "create" ? "Create persona" : "Save persona"}
            </button>
            <button className="cta cta-secondary" onClick={() => router.push("/admin/personas")} type="button">
              Cancel
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
