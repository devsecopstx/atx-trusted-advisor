import { ObjectId } from "mongodb";

export type PersonaCollectionVerification = {
  status: "verified" | "missing" | "error" | "skipped";
  checkedAt: Date;
  message?: string;
  resolvedCollectionName?: string;
};

export type PersonaXapiMode = "responses" | "chat_completions";

export type PersonaXapiToolChoice = "auto" | "required" | "none";

export const PERSONA_XAPI_TOOL_TYPES = [
  "web_search",
  "x_search",
  "file_search",
  "collections_search",
  "yahoo_finance",
  "atxfinance"
] as const;
export type PersonaXapiToolType = (typeof PERSONA_XAPI_TOOL_TYPES)[number];

export type PersonaXapiToolDefinition = {
  type: PersonaXapiToolType;
  [key: string]: unknown;
};

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

export const ATXFINANCE_COLLECTION_ID = "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236";

export const SUPER_AGENT_DEFAULT_TOOLS: PersonaXapiToolDefinition[] = [
  { type: "web_search" },
  { type: "x_search" },
  { type: "collections_search", collection_ids: [ATXFINANCE_COLLECTION_ID] },
  { type: "yahoo_finance" },
  { type: "atxfinance" }
];

export const personaStatusValues = ["draft", "published", "archived"] as const;
export type PersonaStatus = (typeof personaStatusValues)[number];

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
  xaiCollectionVerification?: PersonaCollectionVerification;
  model: string;
  temperature: number;
  enableRag: boolean;
  defaultScope: string;
  xapi?: PersonaXapiConfig;
  status?: PersonaStatus;
  version?: number;
  publishedAt?: Date;
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

export type XChatSessionLog = {
  _id?: ObjectId;
  requestId: string;
  correlationId: string;
  userId?: ObjectId;
  tenantId?: ObjectId;
  userEmail?: string;
  requestedBy?: string;
  personaId?: ObjectId;
  message: string;
  response: string;
  contextChunkIds: ObjectId[];
  model: string;
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
    const isCollectionTool = tool.type === "file_search" || tool.type === "collections_search";
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
    tools
  };
}
