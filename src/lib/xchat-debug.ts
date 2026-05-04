/**
 * xChat structured debug — **tenant workspace only** (`tenantPreferences.xchat_debug_enabled`,
 * set in Admin → Tenant workspace). Emits payloads for RAG/expert learning. Configure Cloud Logging
 * retention (e.g. 30 days) at project or log-bucket level.
 *
 * **Taxonomy (for Cloud Logging filters):**
 * - **`[xchat/debug]`** — opt-in JSON lines when request ALS has tenant debug on; never from browser runtimes. Fields
 *   `type`: `xchat_ask` | `xchat_ask_full` | `xchat_ask_pre_request` |
 *   `xchat_ask_provider_error` | `xchat_batch` | `xchat_history_list` | `xchat_history_stats`.
 *   Workspace snapshot (same prefix, not in `XCHAT_DEBUG_LOG_TYPES`): `workspace_snapshot_load` | `workspace_snapshot_build`.
 *   See `atx-docs/xchat/xchat-debug-logging.md` and `atx-docs/sre-ops/mongo-indexing-guide.md` §8.
 * - **`[xchat/ask]`** — operational `console.warn` / `console.error` on RAG or
 *   provider failures (always on; no full prompts).
 * - **`[xchat/batch]`** — operational errors on batch submit/poll (always on).
 */
import { getXchatTenantDebugFromContext } from "@/lib/xchat-debug-context";

/** Never emit `[xchat/debug]` from browser bundles (even if code is accidentally client-reachable). */
function isBrowserLikeRuntime(): boolean {
  return typeof window !== "undefined";
}

/**
 * True when structured `[xchat/debug]` logs should run: **only** if the request is wrapped with
 * `runWithXchatTenantDebugAsync` / `runWithXchatTenantDebug` and the tenant has
 * `xchat_debug_enabled` (see xChat / history / batch API routes).
 * Always false in the browser — diagnostics are server-only (Cloud Logging / `next dev` terminal).
 */
export function isXchatStructuredDebugEnabled(): boolean {
  if (isBrowserLikeRuntime()) {
    return false;
  }
  return getXchatTenantDebugFromContext();
}

function isXchatDebugEnabled(): boolean {
  return isXchatStructuredDebugEnabled();
}

export const XCHAT_DEBUG_LOG_TYPES = [
  "xchat_ask",
  "xchat_ask_full",
  "xchat_ask_pre_request",
  "xchat_ask_provider_error",
  "xchat_batch",
  "xchat_history_list",
  "xchat_history_stats"
] as const;

export type XchatDebugLogType = (typeof XCHAT_DEBUG_LOG_TYPES)[number];

const LOG_PREFIX = "[xchat/debug]";

function maskCollectionId(id: string | undefined): string | undefined {
  if (!id?.trim()) return undefined;
  const t = id.trim();
  if (t.length <= 8) return "***";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

function maskUserId(id: string | undefined): string {
  if (!id) return "?";
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function maskEmail(email: string | undefined): string {
  if (!email) return "?";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked = local.length <= 2 ? "***" : `${local.slice(0, 2)}***`;
  return `${masked}@${domain}`;
}

/** Logs outbound `/v1/responses` tool wire JSON **before** the provider call (so 502/422 still have diagnostics). */
export function logXchatAskPreRequestDebug(payload: {
  personaId?: string;
  personaName?: string;
  model?: string;
  toolChoice?: string;
  maxTurns?: number;
  /** Final wire tools after `buildWireToolsForXaiResponses` (same bytes as the fetch body). */
  wireTools: Array<Record<string, unknown>>;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_ask_pre_request" satisfies XchatDebugLogType,
    personaId: payload.personaId,
    personaName: payload.personaName,
    model: payload.model,
    toolChoice: payload.toolChoice,
    maxTurns: payload.maxTurns,
    toolCount: payload.wireTools.length,
    wireTools: payload.wireTools
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatAskProviderErrorDebug(payload: {
  personaId?: string;
  personaName?: string;
  error: string;
  wireTools: Array<Record<string, unknown>>;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_ask_provider_error" satisfies XchatDebugLogType,
    personaId: payload.personaId,
    personaName: payload.personaName,
    error: payload.error,
    toolCount: payload.wireTools.length,
    wireTools: payload.wireTools
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatAskDebug(payload: {
  userId?: string;
  email?: string;
  personaId?: string;
  personaName?: string;
  message: string;
  systemPrompt: string;
  userPrompt: string;
  ragContextLength: number;
  contextSource: "none" | "xai_collection";
  contextCount: number;
  tools: string[];
  model?: string;
  responseLength?: number;
  mode?: string;
  /** RAG / tenant scope label (not PII). */
  scope?: string;
  /** Masked xAI collection id when collection search was used. */
  collectionId?: string;
  toolCallCount?: number;
  modelSelectionSource?:
    | "default"
    | "persona"
    | "vision_env"
    | "reasoning_mode"
    | "reasoning_mode_fallback";
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_ask" satisfies XchatDebugLogType,
    userId: maskUserId(payload.userId),
    email: maskEmail(payload.email),
    personaId: payload.personaId,
    personaName: payload.personaName,
    messageLength: payload.message.length,
    messagePreview: payload.message.slice(0, 200) + (payload.message.length > 200 ? "…" : ""),
    systemPromptLength: payload.systemPrompt.length,
    systemPromptPreview: payload.systemPrompt.slice(0, 500) + (payload.systemPrompt.length > 500 ? "…" : ""),
    userPromptLength: payload.userPrompt.length,
    userPromptPreview: payload.userPrompt.slice(0, 300) + (payload.userPrompt.length > 300 ? "…" : ""),
    ragContextLength: payload.ragContextLength,
    contextSource: payload.contextSource,
    contextCount: payload.contextCount,
    tools: payload.tools,
    model: payload.model,
    responseLength: payload.responseLength,
    mode: payload.mode,
    scope: payload.scope,
    collectionId: maskCollectionId(payload.collectionId),
    toolCallCount: payload.toolCallCount,
    modelSelectionSource: payload.modelSelectionSource
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatAskFullPayload(payload: {
  userId?: string;
  personaName?: string;
  systemPrompt: string;
  userPrompt: string;
  ragContext: string;
  tools: string[];
  model?: string;
  responseText?: string;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_ask_full" satisfies XchatDebugLogType,
    userId: maskUserId(payload.userId),
    personaName: payload.personaName,
    systemPrompt: payload.systemPrompt,
    userPrompt: payload.userPrompt,
    ragContext: payload.ragContext,
    tools: payload.tools,
    model: payload.model,
    responseText: payload.responseText,
    /** Raw provider text; `/api/xchat/ask` and the client both run `preprocessXchatMarkdown` (idempotent). */
    markdownPipelineNote:
      "responseText is raw xAI output; assistant bubbles also preprocess before ReactMarkdown for backward compatibility."
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatBatchDebug(payload: {
  /** `item_prepare` = per line while building JSONL; `job_created` = after xAI batch id is known. */
  batchPhase: "item_prepare" | "job_created";
  batchId?: string;
  personaId?: string;
  personaName?: string;
  itemCount: number;
  itemId?: string;
  messagePreview?: string;
  systemPromptLength?: number;
  userPromptLength?: number;
  ragContextLength?: number;
  tools?: string[];
  collectionId?: string;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_batch" satisfies XchatDebugLogType,
    batchPhase: payload.batchPhase,
    batchId: payload.batchId,
    personaId: payload.personaId,
    personaName: payload.personaName,
    itemCount: payload.itemCount,
    itemId: payload.itemId,
    messagePreview: payload.messagePreview,
    systemPromptLength: payload.systemPromptLength,
    userPromptLength: payload.userPromptLength,
    ragContextLength: payload.ragContextLength,
    tools: payload.tools,
    collectionId: maskCollectionId(payload.collectionId)
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatHistoryListDebug(payload: {
  userId?: string;
  email?: string;
  limit: number;
  itemCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_history_list" satisfies XchatDebugLogType,
    userId: maskUserId(payload.userId),
    email: maskEmail(payload.email),
    limit: payload.limit,
    itemCount: payload.itemCount,
    hasMore: payload.hasMore,
    nextCursor: payload.nextCursor ?? null
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}

export function logXchatHistoryStatsDebug(payload: {
  userId?: string;
  email?: string;
  totalPrompts: number;
  lastPromptAt?: string;
  collectionId?: string | null;
}): void {
  if (!isXchatDebugEnabled()) return;

  const safe = {
    ts: new Date().toISOString(),
    type: "xchat_history_stats" satisfies XchatDebugLogType,
    userId: maskUserId(payload.userId),
    email: maskEmail(payload.email),
    totalPrompts: payload.totalPrompts,
    lastPromptAt: payload.lastPromptAt ?? null,
    collectionId: maskCollectionId(payload.collectionId ?? undefined)
  };

  console.info(LOG_PREFIX, JSON.stringify(safe));
}
