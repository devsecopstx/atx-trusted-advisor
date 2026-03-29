import { z } from "zod";

import { getPersonaLinkedCollectionIds } from "@/modules/xchat/persona-linked-collections";
import {
    DEFAULT_PERSONA_XAPI_CONFIG,
    normalizePersonaXapiConfig,
    type PersonaXapiConfig
} from "@/modules/xchat/types";
import { XAI_PERSONA_CHAT_MODEL_FALLBACK_ID } from "@/modules/xchat/xai-persona-chat-models";

export const PERSONA_VALIDATION_LIMITS = {
  payloadBytes: 32 * 1024,
  nameLength: 80,
  systemPromptLength: 16_000,
  overridePromptLength: 16_000,
  xaiCollectionIdLength: 120,
  xaiCollectionNameLength: 120,
  modelLength: 120,
  scopeLength: 80,
  xapiToolsLength: 32
} as const;
const temperatureSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return Number(value.replace(",", ".").trim());
    }
    return value;
  },
  z.number().min(0).max(1)
);

const booleanSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    return value;
  },
  z.boolean()
);

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }
      return value;
    },
    z.string().trim().max(maxLength).optional()
  );

const xaiCollectionSchema = z.object({
  collectionId: optionalTrimmedString(PERSONA_VALIDATION_LIMITS.xaiCollectionIdLength).refine(
    (value) => value === undefined || /^collection_[A-Za-z0-9-]+$/.test(value),
    "Invalid xAI collection id"
  ),
  collectionName: optionalTrimmedString(PERSONA_VALIDATION_LIMITS.xaiCollectionNameLength)
});

const SUPPORTED_XAPI_TOOL_TYPES = [
  "web_search",
  "x_search",
  "code_interpreter",
  "file_search",
  "collections_search",
  "yahoo_finance",
  "atx_function",
  // Legacy alias kept so older persona payloads still validate.
  "atxfinance"
] as const;

const xapiToolSchema = z
  .object({
    type: z.enum(SUPPORTED_XAPI_TOOL_TYPES),
    source: z
      .object({
        collection_ids: z.array(z.string().trim().min(1)).min(1)
      })
      .optional(),
    collection_ids: z.array(z.string().trim().min(1)).optional()
  })
  .passthrough();

const maxTurnsSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return Number(value.trim());
    }
    return value;
  },
  z.number().int().min(1).max(10)
);

const xapiSchema = z.object({
  mode: z.enum(["responses", "chat_completions"]).default(DEFAULT_PERSONA_XAPI_CONFIG.mode),
  toolChoice: z.enum(["auto", "required", "none"]).default(DEFAULT_PERSONA_XAPI_CONFIG.toolChoice),
  maxTurns: maxTurnsSchema.default(DEFAULT_PERSONA_XAPI_CONFIG.maxTurns),
  tools: z.array(xapiToolSchema).max(PERSONA_VALIDATION_LIMITS.xapiToolsLength).default([])
});

export function hasFileSearchTool(
  tools: Array<{ type: string; [key: string]: unknown }> | undefined
): boolean {
  return (
    Array.isArray(tools) &&
    tools.some((tool) => tool.type === "file_search" || tool.type === "collections_search")
  );
}

/** At least one persona/team/tool collection id when file_search / collections_search is enabled. */
export function personaSatisfiesFileSearchCollectionRequirement(value: {
  xaiCollection?: { collectionId?: string };
  teamCollection?: { collectionId?: string };
  xapi: PersonaXapiConfig;
}): boolean {
  if (!hasFileSearchTool(value.xapi.tools)) {
    return true;
  }
  const ids = getPersonaLinkedCollectionIds({
    xaiCollection: value.xaiCollection,
    teamCollection: value.teamCollection,
    xapi: value.xapi
  });
  return ids.length > 0;
}

export const createPersonaPayloadSchema = z.object({
  name: z.string().trim().min(2).max(PERSONA_VALIDATION_LIMITS.nameLength),
  systemPrompt: z.string().trim().min(10).max(PERSONA_VALIDATION_LIMITS.systemPromptLength),
  overridePrompt: optionalTrimmedString(PERSONA_VALIDATION_LIMITS.overridePromptLength),
  xaiCollection: xaiCollectionSchema.optional(),
  teamCollection: xaiCollectionSchema.optional(),
  model: z
    .string()
    .trim()
    .min(1)
    .max(PERSONA_VALIDATION_LIMITS.modelLength)
    .default(XAI_PERSONA_CHAT_MODEL_FALLBACK_ID),
  temperature: temperatureSchema.default(0.2),
  enableRag: booleanSchema.default(true),
  defaultScope: z
    .string()
    .trim()
    .min(1)
    .max(PERSONA_VALIDATION_LIMITS.scopeLength)
    .default("global"),
  xapi: xapiSchema.default(DEFAULT_PERSONA_XAPI_CONFIG)
}).superRefine((value, context) => {
  const xapi = normalizePersonaXapiConfig(value.xapi);
  if (!personaSatisfiesFileSearchCollectionRequirement({ ...value, xapi })) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["xaiCollection", "collectionId"],
      message:
        "Collection search (file_search / collections_search) requires xaiCollection.collectionId, teamCollection.collectionId, or collection ids on tools"
    });
  }
});

export const updatePersonaPayloadSchema = z.object({
  name: optionalTrimmedString(PERSONA_VALIDATION_LIMITS.nameLength).refine(
    (value) => value === undefined || value.length >= 2,
    "String must contain at least 2 character(s)"
  ),
  systemPrompt: optionalTrimmedString(PERSONA_VALIDATION_LIMITS.systemPromptLength).refine(
    (value) => value === undefined || value.length >= 10,
    "String must contain at least 10 character(s)"
  ),
  overridePrompt: z.string().trim().max(PERSONA_VALIDATION_LIMITS.overridePromptLength).optional(),
  xaiCollection: xaiCollectionSchema.optional(),
  teamCollection: xaiCollectionSchema.optional(),
  model: optionalTrimmedString(PERSONA_VALIDATION_LIMITS.modelLength),
  temperature: temperatureSchema.optional(),
  enableRag: booleanSchema.optional(),
  defaultScope: optionalTrimmedString(PERSONA_VALIDATION_LIMITS.scopeLength),
  xapi: xapiSchema.optional()
});

export function isPersonaPayloadTooLargeByHeader(request: Request): boolean {
  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader) {
    return false;
  }
  const parsedLength = Number(contentLengthHeader);
  return Number.isFinite(parsedLength) && parsedLength > PERSONA_VALIDATION_LIMITS.payloadBytes;
}

export function isPersonaPayloadTooLargeByBody(body: unknown): boolean {
  return encodedByteLength(body) > PERSONA_VALIDATION_LIMITS.payloadBytes;
}

function encodedByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
