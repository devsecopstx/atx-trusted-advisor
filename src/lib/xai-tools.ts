import {
    ATXFINANCE_TOOL_DEFINITION,
    YAHOO_FINANCE_TOOL_DEFINITION
} from "@/modules/xchat/tool-definitions";
import type { PersonaXapiToolDefinition } from "@/modules/xchat/tool-types";

/**
 * xAI Responses API (`/v1/responses`) expects hosted `file_search` with
 * `vector_store_ids` (OpenAI-compatible wire shape). Personas still store
 * `source.collection_ids` / `collections_search` + `collection_ids`; we normalize here.
 */
function vectorStoreIdsFromTool(tool: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const add = (raw: unknown) => {
    if (!Array.isArray(raw)) {
      return;
    }
    for (const id of raw) {
      if (typeof id === "string" && id.trim().length > 0) {
        out.add(id.trim());
      }
    }
  };
  add(tool.vector_store_ids);
  const source = tool.source;
  if (source && typeof source === "object" && source !== null) {
    add((source as { collection_ids?: unknown }).collection_ids);
  }
  return Array.from(out);
}

function fileSearchWireTool(ids: string[]): { type: "file_search"; vector_store_ids: string[] } {
  return { type: "file_search", vector_store_ids: ids };
}

/**
 * `/v1/responses` expects function tools **flat**: `type`, `name`, `parameters` (and optional `description`)
 * at the root. OpenAI-style `{ type, function: { name, parameters } }` yields 422
 * `tools[N]: missing field parameters` — the request never reaches hosted web_search / x_search.
 */
function flattenFunctionToolForXaiResponses(tool: Record<string, unknown>): Record<string, unknown> {
  if (tool.type !== "function") {
    return tool;
  }
  const nested = tool.function;
  if (nested && typeof nested === "object") {
    const fn = nested as Record<string, unknown>;
    const name =
      (typeof tool.name === "string" && tool.name.trim().length > 0
        ? tool.name.trim()
        : typeof fn.name === "string"
          ? fn.name.trim()
          : "") || "";
    const out: Record<string, unknown> = {
      type: "function",
      name,
      parameters:
        fn.parameters != null && typeof fn.parameters === "object"
          ? fn.parameters
          : { type: "object", properties: {} }
    };
    if (typeof fn.description === "string" && fn.description.length > 0) {
      out.description = fn.description;
    }
    return out;
  }
  if (tool.parameters === undefined) {
    return { ...tool, parameters: { type: "object", properties: {} } };
  }
  return { ...tool };
}

/**
 * xAI `/v1/responses` Rust deserializer expects a top-level `name` on each tool entry.
 * - Hosted tools: default to `String(type)` when missing.
 * - Nested OpenAI `function` tools: use `flattenFunctionToolForXaiResponses` when `forXaiResponsesApi`.
 */
function ensureResponsesToolNameCompat(tool: Record<string, unknown>): Record<string, unknown> {
  const t = tool.type;
  if (t === "function" && tool.function && typeof tool.function === "object") {
    const fn = tool.function as Record<string, unknown>;
    const n = typeof fn.name === "string" ? fn.name.trim() : "";
    if (n.length > 0 && tool.name === undefined) {
      return { ...tool, name: n };
    }
  }
  if (
    (t === "web_search" || t === "x_search" || t === "file_search") &&
    tool.name === undefined
  ) {
    return { ...tool, name: String(t) };
  }
  return tool;
}

export type ToXaiRequestToolsOptions = {
  /** When true (default false), flatten `function` tools for `POST /v1/responses`. Chat Completions keeps OpenAI nested shape. */
  forXaiResponsesApi?: boolean;
};

export function toXaiRequestTools(
  tools: Array<Record<string, unknown>>,
  options?: ToXaiRequestToolsOptions
): Array<Record<string, unknown>> {
  const forResponses = options?.forXaiResponsesApi === true;
  const result: Array<Record<string, unknown>> = [];
  for (const tool of tools) {
    const type = tool.type;
    if (type === "collections_search") {
      const ids = tool.collection_ids;
      const collectionIds = Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [];
      if (collectionIds.length === 0) {
        continue;
      }
      result.push(ensureResponsesToolNameCompat(fileSearchWireTool(collectionIds) as Record<string, unknown>));
      continue;
    }
    if (type === "file_search") {
      const ids = vectorStoreIdsFromTool(tool);
      if (ids.length === 0) {
        continue;
      }
      result.push(ensureResponsesToolNameCompat(fileSearchWireTool(ids) as Record<string, unknown>));
      continue;
    }
    let wire: Record<string, unknown> = { ...tool };
    if (forResponses) {
      wire = flattenFunctionToolForXaiResponses(wire);
    }
    result.push(ensureResponsesToolNameCompat(wire));
  }
  return result;
}

/**
 * Expands persona marker tools (`atxfinance`, `yahoo_finance`) into xAI function schemas,
 * same as `POST /api/xchat/ask` before `respondWithXaiToolLoop`. Use for batch and any
 * path that must mirror persona tool configuration.
 */
export function personaXapiToolsToXaiRequestTools(
  tools: PersonaXapiToolDefinition[]
): Array<Record<string, unknown>> {
  const hasAtxfinance = tools.some((t) => t.type === "atxfinance");
  const hasYahooFinance = tools.some((t) => t.type === "yahoo_finance");
  const base: Array<Record<string, unknown>> = tools
    .filter((t) => t.type !== "atxfinance" && t.type !== "yahoo_finance")
    .map((t) => ({ ...t }));
  if (hasAtxfinance) {
    base.push(ATXFINANCE_TOOL_DEFINITION as unknown as Record<string, unknown>);
  }
  if (hasYahooFinance) {
    base.push(YAHOO_FINANCE_TOOL_DEFINITION as unknown as Record<string, unknown>);
  }
  return toXaiRequestTools(base, { forXaiResponsesApi: true });
}

/**
 * Wire tools sent to `/v1/responses` — identical to `personaXapiToolsToXaiRequestTools` (which already
 * runs `toXaiRequestTools` with `forXaiResponsesApi: true`). Exposed for debug logging; do not wrap
 * again in `toXaiRequestTools` or tools are double-normalized and logs diverge from the actual request.
 */
export function buildWireToolsForXaiResponses(
  personaTools: PersonaXapiToolDefinition[]
): Array<Record<string, unknown>> {
  return personaXapiToolsToXaiRequestTools(personaTools);
}
