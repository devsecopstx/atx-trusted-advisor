import { ObjectId } from "mongodb";

import { getTeamXaiKbCollectionIdSync } from "./team-xai-collection-sync";
import {
    PERSONA_XAPI_TOOL_TYPES,
    type PersonaXapiToolDefinition,
    type PersonaXapiToolType
} from "./tool-types";

export { PERSONA_XAPI_TOOL_TYPES, type PersonaXapiToolDefinition, type PersonaXapiToolType };
export const ATX_FUNCTION_TOOL_TYPES = ["atx_function"] as const;

export function isAtxFunctionToolType(type: string): boolean {
  return type === "atx_function";
}

export function orderPersonaXapiTools(
  tools: PersonaXapiToolDefinition[],
  options?: { ensureHostedSearch?: boolean }
): PersonaXapiToolDefinition[] {
  const merged = [...tools];
  if (options?.ensureHostedSearch) {
    if (!merged.some((tool) => tool.type === "web_search")) {
      merged.push({ type: "web_search" });
    }
    if (!merged.some((tool) => tool.type === "x_search")) {
      merged.push({ type: "x_search" });
    }
  }
  return merged;
}

export type PersonaCollectionVerification = {
  status: "verified" | "missing" | "error" | "skipped";
  checkedAt: Date;
  message?: string;
  resolvedCollectionName?: string;
};

export type PersonaXapiMode = "responses" | "chat_completions";

export type PersonaXapiToolChoice = "auto" | "required" | "none";

export type PersonaXapiConfig = {
  mode: PersonaXapiMode;
  toolChoice: PersonaXapiToolChoice;
  maxTurns: number;
  tools: PersonaXapiToolDefinition[];
};

export const DEFAULT_PERSONA_XAPI_CONFIG: PersonaXapiConfig = {
  mode: "responses",
  toolChoice: "auto",
  maxTurns: 5,
  tools: []
};

/**
 * Global-admin **advisor** preset: `atx_function` + `yahoo_finance` + optional `file_search` (single team KB id when `XAI_TEAM_ID` is a literal `collection_*`).
 */
export function getAdvisorDefaultTools(): PersonaXapiToolDefinition[] {
  const cid = getTeamXaiKbCollectionIdSync();
  if (cid) {
    return [
      { type: "atx_function" },
      { type: "yahoo_finance" },
      { type: "file_search", collection_ids: [cid] }
    ];
  }
  return [{ type: "atx_function" }, { type: "yahoo_finance" }];
}

/** Legacy **super-agent** row: full research + `collections_search` when env resolves a KB collection id. */
export function getSuperAgentDefaultTools(): PersonaXapiToolDefinition[] {
  const cid = getTeamXaiKbCollectionIdSync();
  if (cid) {
    return [
      { type: "atx_function" },
      { type: "collections_search", collection_ids: [cid] },
      { type: "yahoo_finance" },
      { type: "web_search" },
      { type: "x_search" },
      { type: "code_interpreter" }
    ];
  }
  return [
    { type: "atx_function" },
    { type: "yahoo_finance" },
    { type: "web_search" },
    { type: "x_search" },
    { type: "code_interpreter" }
  ];
}

/**
 * Seeded global-admin default personas (`name` lowercased). Legacy `super-agent` included until DBs migrate.
 * @see `scripts/seed-admin-user.mjs` — primary slug is `advisor`.
 */
export const DEFAULT_GLOBAL_ADMIN_PERSONA_NAME_KEYS = new Set(["advisor", "super-agent"]);

/** @deprecated Use {@link DEFAULT_GLOBAL_ADMIN_PERSONA_NAME_KEYS} / `advisor`. */
export const SUPER_AGENT_NAME_NORMALIZED = "advisor";

/**
 * If Mongo `xapi.tools` was cleared or edited down, restore the **baseline** tool set for global-admin defaults:
 * **`advisor`** → {@link getAdvisorDefaultTools}; legacy **`super-agent`** → {@link getSuperAgentDefaultTools}.
 * Applied in `POST /api/xchat/ask` and xChat batch after `normalizePersonaXapiConfig`.
 */
export function ensureSuperAgentDefaultTools(
  config: PersonaXapiConfig,
  personaDisplayName: string | undefined
): PersonaXapiConfig {
  const key = personaDisplayName?.trim().toLowerCase();
  if (!key || !DEFAULT_GLOBAL_ADMIN_PERSONA_NAME_KEYS.has(key)) {
    return config;
  }
  const baseline = key === "super-agent" ? getSuperAgentDefaultTools() : getAdvisorDefaultTools();
  const have = new Set(config.tools.map((t) => t.type));
  const merged: PersonaXapiToolDefinition[] = [...config.tools];
  for (const def of baseline) {
    if (!have.has(def.type)) {
      merged.push({ ...def });
      have.add(def.type);
    }
  }
  return { ...config, tools: merged };
}

/**
 * No-op baseline merge: preserve admin-defined tool ordering on ask/batch.
 * Hosted search insertion is controlled by admin persona config (or optional UI guardrail toggle).
 */
export function mergeXchatHostedToolBaseline(config: PersonaXapiConfig): PersonaXapiConfig {
  return config;
}

export const personaStatusValues = ["draft", "published", "archived"] as const;
export type PersonaStatus = (typeof personaStatusValues)[number];

/** xAI collection id + optional display name (persona-bound KB, team KB, etc.). */
export type PersonaCollectionRef = {
  collectionId?: string;
  collectionName?: string;
};

export type PersonaConfig = {
  _id?: ObjectId;
  name: string;
  nameNormalized: string;
  systemPrompt: string;
  overridePrompt: string;
  xaiCollection?: {
    collectionId?: string;
    collectionName?: string;
  };
  /**
   * Optional team/org KB (merged with `xaiCollection` and tool `collection_ids` for RAG + file_search).
   * Use when the persona should search two distinct xAI collections (e.g. curated + team).
   */
  teamCollection?: PersonaCollectionRef;
  /** Last admin verification of persona-bound xAI collection (optional). */
  xaiCollectionVerification?: PersonaCollectionVerification;
  model: string;
  temperature: number;
  enableRag: boolean;
  defaultScope: string;
  /**
   * When false, xChat system prompt omits the citation-chip contract so the model should not emit
   * `[@citation:…]` / xf-citation markup. Default true when unset (legacy rows).
   */
  citationsEnabled?: boolean;
  /**
   * When false and `XCHAT_USE_REMOTE_HISTORY=true`, that persona skips xAI `previous_response_id` /
   * `store_messages` continuity. Default true when unset (legacy rows). Reserved for tighter control
   * alongside platform env.
   */
  keepXchatHistory?: boolean;
  xapi?: PersonaXapiConfig;
  status?: PersonaStatus;
  version?: number;
  publishedAt?: Date;
  /** Repo-seeded persona row (e.g. `npm run seed:xpersonas`); admin CRUD still allowed. */
  isSystem?: boolean;
  /** Last successful admin “sync from xAI collection” for this persona row. */
  lastXaiPersonaSync?: {
    at: Date;
    byUserId: string;
    collectionDisplayName: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type PersonaVersionSnapshot = {
  _id?: ObjectId;
  personaId: ObjectId;
  version: number;
  snapshot: Omit<PersonaConfig, "_id">;
  action: "published" | "rolled_back" | "archived";
  actor: {
    userId: string;
    email?: string;
    username?: string;
  };
  createdAt: Date;
};

export type RagSourceFile = {
  _id?: ObjectId;
  userId?: ObjectId;
  tenantId?: ObjectId;
  userEmail?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string;
  scope: string;
  xaiFileId?: string;
  xaiUploadStatus: "uploaded" | "failed" | "skipped";
  xaiProcessingStatus?:
    | "pending"
    | "processing"
    | "complete"
    | "failed"
    | "skipped"
    | "unknown";
  xaiProcessingCheckedAt?: Date;
  xaiUploadError?: string;
  contentPreview: string;
  createdAt: Date;
};

export type RagChunk = {
  _id?: ObjectId;
  fileId: ObjectId;
  userId?: ObjectId;
  tenantId?: ObjectId;
  scope: string;
  chunkIndex: number;
  text: string;
  tokenEstimate: number;
  createdAt: Date;
};

export type XChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Snapshot of xAI `/v1/responses` `usage` when returned (admin cost analytics). */
export type XChatXaiUsageSnapshot = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedPromptTokens?: number;
};

/** One prompt/response turn in Mongo `xchat_logs` (TTL via retentionExpiresAt). user_history_agent syncs unsynced rows to the user xAI collection. */
export type XChatSessionLog = {
  _id?: ObjectId;
  /** Client conversation thread key (per xChat thread/session). */
  threadId?: string;
  requestId: string;
  correlationId: string;
  userId?: ObjectId;
  tenantId?: ObjectId;
  userEmail?: string;
  requestedBy?: string;
  personaId?: ObjectId;
  /** Denormalized for scheduled markdown sync (persona name at ask time). */
  personaName?: string;
  /** xChat scope / KB scope at ask time. */
  scope?: string;
  message: string;
  response: string;
  contextChunkIds: ObjectId[];
  model: string;
  /** Parsed from last xAI Responses payload when present. */
  xaiUsage?: XChatXaiUsageSnapshot;
  /** xAI `/responses` id returned for this turn; used to continue remote conversation state safely. */
  xaiResponseId?: string;
  xapiMode?: PersonaXapiMode;
  xapiToolChoice?: PersonaXapiToolChoice;
  xapiMaxTurns?: number;
  xapiToolCount?: number;
  collectionContextReferences?: Array<{
    documentId?: string;
    documentName?: string;
    snippetFingerprint: string;
  }>;
  xapiToolCalls?: Array<{
    name: string;
    args?: Record<string, unknown>;
    resultHash?: string;
    durationMs: number;
    error?: string;
  }>;
  xaiTurnFileId?: string;
  xaiTurnPayloadHash?: string;
  xaiTurnRetentionExpiresAt?: Date;
  /** Set when markdown turn was uploaded and linked to the user xAI collection (user_history source). */
  syncedToXaiAt?: Date;
  xaiTurnSyncError?: string;
  /** User explicitly opted out of strategy-job handoff for this thread. */
  strategyJobOptOut?: boolean;
  retentionExpiresAt?: Date;
  createdAt: Date;
};

export type XChatHistoryItem = {
  id: string;
  message: string;
  response: string;
  model: string;
  createdAt: Date;
  personaId?: string;
  contextReferenceCount: number;
  toolCallCount: number;
};

export type XChatHistoryStats = {
  totalPrompts: number;
  activeDays: number;
  referencedFileCount: number;
  lastPromptAt?: Date;
};

export function normalizePersonaXapiConfig(input?: Partial<PersonaXapiConfig> | null): PersonaXapiConfig {
  const mode = input?.mode === "chat_completions" ? "chat_completions" : "responses";
  const toolChoice =
    input?.toolChoice === "required" || input?.toolChoice === "none" ? input.toolChoice : "auto";
  const maxTurnsRaw = Number(input?.maxTurns ?? DEFAULT_PERSONA_XAPI_CONFIG.maxTurns);
  const maxTurns =
    Number.isInteger(maxTurnsRaw) && maxTurnsRaw >= 1 && maxTurnsRaw <= 10
      ? maxTurnsRaw
      : DEFAULT_PERSONA_XAPI_CONFIG.maxTurns;
  const rawTools = Array.isArray(input?.tools)
    ? input.tools.filter(
        (tool): tool is PersonaXapiToolDefinition =>
          Boolean(tool) &&
          typeof tool === "object" &&
          typeof tool.type === "string" &&
          (PERSONA_XAPI_TOOL_TYPES as readonly string[]).includes(tool.type)
      )
    : [];

  const seenTypes = new Set<string>();
  const tools: PersonaXapiToolDefinition[] = [];
  for (const tool of rawTools) {
    const isAtxFunctionTool = isAtxFunctionToolType(tool.type);
    const isCollectionTool = tool.type === "file_search" || tool.type === "collections_search";
    if (isAtxFunctionTool) {
      if (seenTypes.has("__atx_function__")) {
        continue;
      }
      seenTypes.add("__atx_function__");
      tools.push(tool);
      continue;
    }
    if (isCollectionTool) {
      if (seenTypes.has("__collection__")) {
        continue;
      }
      seenTypes.add("__collection__");
      tools.push(tool);
      continue;
    }
    if (!seenTypes.has(tool.type)) {
      seenTypes.add(tool.type);
      tools.push(tool);
    }
  }

  return {
    mode,
    toolChoice,
    maxTurns,
    tools: orderPersonaXapiTools(tools)
  };
}
