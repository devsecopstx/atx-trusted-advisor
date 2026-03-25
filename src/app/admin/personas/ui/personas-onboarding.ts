import { getSuperAgentDefaultTools } from "@/modules/xchat/types";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

export type PersonaFormState = {
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

export type XaiCollectionInventoryOption = {
  id: string;
  name?: string;
  stats: {
    documentCount: number | null;
    chunkCount?: number | null;
    fileCount?: number | null;
    indexStatus?: string | null;
    lastSyncedAt?: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    usageStats?: Record<string, unknown> | null;
  };
};

export const DEFAULT_XPERSONA_TEST_SYSTEM_PROMPT =
  "You are The Architect, an elite administrative agent with full access to the xAI ecosystem. You have a multi-layered toolset including Web Search, X (Twitter) Search, a Python Code Sandbox, and Private Collection Search.";

/** Default explicit `xapi.tools` for new personas (web, X, collections when env resolves, yahoo, atxfinance). */
export function getDefaultXpersonaToolsJson(): string {
  return JSON.stringify(getSuperAgentDefaultTools(), null, 2);
}

export const DEFAULT_XPERSONA_TOOLS_JSON = getDefaultXpersonaToolsJson();

export function parsePersonaXapiToolsJson(value: string): Array<{ type: string; [key: string]: unknown }> {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Tools JSON must be valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Tools JSON must be an array");
  }
  const tools = parsed.filter(
    (entry): entry is { type: string; [key: string]: unknown } =>
      Boolean(entry) &&
      typeof entry === "object" &&
      "type" in entry &&
      typeof (entry as { type?: unknown }).type === "string"
  );
  if (tools.length !== parsed.length) {
    throw new Error("Each tool must include a string 'type' field");
  }
  return tools;
}

export function personaToolsIncludeHostedSearch(tools: ReadonlyArray<{ type: string }>): boolean {
  return tools.some((t) => t.type === "web_search" || t.type === "x_search");
}

/** Prepends `web_search` / `x_search` when missing so saved personas stay usable for live + batch. */
export function mergeHostedSearchIntoPersonaTools(
  tools: Array<{ type: string; [key: string]: unknown }>
): Array<{ type: string; [key: string]: unknown }> {
  const hasWeb = tools.some((t) => t.type === "web_search");
  const hasX = tools.some((t) => t.type === "x_search");
  const prefix: Array<{ type: string; [key: string]: unknown }> = [];
  if (!hasWeb) {
    prefix.push({ type: "web_search" });
  }
  if (!hasX) {
    prefix.push({ type: "x_search" });
  }
  return [...prefix, ...tools];
}

export const EMPTY_CREATE_FORM: PersonaFormState = {
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
  xapiToolsJson: getDefaultXpersonaToolsJson()
};

export function applySelectedCollectionToPersonaForm(
  form: PersonaFormState,
  collections: XaiCollectionInventoryOption[],
  collectionId: string
): PersonaFormState {
  const selectedCollection = collections.find((collection) => collection.id === collectionId);
  if (!selectedCollection) {
    if (!collectionId) {
      return {
        ...form,
        xaiCollectionId: "",
        xaiCollectionName: ""
      };
    }
    return {
      ...form,
      xaiCollectionId: collectionId
    };
  }

  return {
    ...form,
    xaiCollectionId: collectionId,
    xaiCollectionName: selectedCollection.name ?? ""
  };
}
