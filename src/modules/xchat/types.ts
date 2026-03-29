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

/** Super-Agent default xAPI tools; `collections_search` is included when `XAI_TEAM_ID` resolves to a KB collection id (sync: `collection_*` on env). */
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

/** Matches `nameNormalized` / display name lowercased for the seeded admin persona (see `scripts/seed-admin-user.mjs`). */
export const SUPER_AGENT_NAME_NORMALIZED = "super-agent";

/**
 * If Mongo `xapi.tools` was cleared or edited down, Super-Agent can lose `web_search` / `x_search` / collections.
 * Applied in `POST /api/xchat/ask` and xChat batch after `normalizePersonaXapiConfig` so live search + KB tools match product intent.
 */
export function ensureSuperAgentDefaultTools(
  config: PersonaXapiConfig,
  personaDisplayName: string | undefined
): PersonaXapiConfig {
  const key = personaDisplayName?.trim().toLowerCase();
  if (key !== SUPER_AGENT_NAME_NORMALIZED) {
    return config;
  }
  const have = new Set(config.tools.map((t) => t.type));
  const merged: PersonaXapiToolDefinition[] = [...config.tools];
  for (const def of getSuperAgentDefaultTools()) {
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

/** One prompt/response turn in Mongo `xchat_logs` (TTL via retentionExpiresAt). user_history_agent syncs unsynced rows to the user xAI collection. */
export type XChatSessionLog = {
  _id?: ObjectId;
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
