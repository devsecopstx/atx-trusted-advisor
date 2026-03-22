import { getEnv } from "@/lib/env";
import { toXaiRequestTools } from "@/lib/xai-tools";

type XaiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type XaiChatResult = {
  model: string;
  outputText: string;
  raw: unknown;
};

type XaiToolChoice = "auto" | "required" | "none";
type XaiReasoningEffort = "low" | "medium" | "high";
type XaiParallelismConfig = {
  agentCount: number;
  reasoningEffort: XaiReasoningEffort;
};

type XaiResponsesResult = {
  model: string;
  outputText: string;
  raw: unknown;
};

type XaiCollectionSearchSnippet = {
  text: string;
  documentId?: string;
  documentName?: string;
};

export type XaiCollectionInventoryItem = {
  id: string;
  name?: string;
  documentCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type XaiFileProcessingStatus = "pending" | "processing" | "complete" | "failed" | "skipped" | "unknown";

type XaiFileMetadata = {
  fileId: string;
  uploadStatus?: string;
  uploadErrorMessage?: string;
  processingStatus: XaiFileProcessingStatus;
};

function getXaiConfig() {
  const env = getEnv();
  return {
    apiKey: env.XAI_API_KEY,
    baseUrl: env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    defaultModel: env.XAI_CHAT_MODEL ?? "grok-4-1-fast-reasoning"
  };
}

function getXaiManagementConfig() {
  const env = getEnv();
  return {
    managementApiKey: env.XAI_MANAGEMENT_API_KEY.trim(),
    managementBaseUrl: env.XAI_MANAGEMENT_BASE_URL ?? "https://management-api.x.ai/v1"
  };
}

export class XaiCollectionNotFoundError extends Error {
  readonly code = "XAI_COLLECTION_NOT_FOUND";

  constructor(collectionId: string) {
    super(`xAI collection not found: ${collectionId}`);
    this.name = "XaiCollectionNotFoundError";
  }
}

export function hasXaiManagementApiKey(): boolean {
  const { managementApiKey } = getXaiManagementConfig();
  return managementApiKey.length > 0;
}

export async function createXaiCollection(collectionName: string): Promise<{
  id: string;
  name: string;
}> {
  const { managementApiKey, managementBaseUrl } = getXaiManagementConfig();

  const normalizedName = collectionName.trim();
  if (!normalizedName) {
    throw new Error("Collection name is required");
  }

  const response = await fetch(`${managementBaseUrl}/collections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managementApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      collection_name: normalizedName
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`xAI collection create failed: ${JSON.stringify(payload.error ?? payload)}`);
  }

  const id =
    (typeof payload.id === "string" ? payload.id : undefined) ??
    (typeof payload.collection_id === "string" ? payload.collection_id : undefined);
  if (!id) {
    throw new Error("xAI collection create returned no collection id");
  }

  const name =
    (typeof payload.name === "string" ? payload.name : undefined) ??
    (typeof payload.collection_name === "string" ? payload.collection_name : undefined) ??
    normalizedName;

  return { id, name };
}

export async function addFileToXaiCollection(input: {
  collectionId: string;
  fileId: string;
}): Promise<{ linked: boolean; alreadyLinked: boolean }> {
  const { managementApiKey, managementBaseUrl } = getXaiManagementConfig();

  const collectionId = input.collectionId.trim();
  const fileId = input.fileId.trim();
  if (!collectionId || !fileId) {
    throw new Error("Collection id and file id are required");
  }

  const response = await fetch(
    `${managementBaseUrl}/collections/${collectionId}/documents/${fileId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementApiKey}`
      }
    }
  );

  if (response.ok) {
    return { linked: true, alreadyLinked: false };
  }
  if (response.status === 409) {
    return { linked: true, alreadyLinked: true };
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  throw new Error(`xAI add file to collection failed: ${JSON.stringify(payload.error ?? payload)}`);
}

export async function uploadFileToXai(
  filename: string,
  bytes: Uint8Array
): Promise<{ fileId: string; processingStatus: XaiFileProcessingStatus }> {
  const { apiKey, baseUrl } = getXaiConfig();
  const formData = new FormData();
  const stableBytes = Uint8Array.from(bytes);
  formData.set(
    "file",
    new Blob([stableBytes], { type: "application/octet-stream" }),
    filename
  );

  const response = await fetch(`${baseUrl}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  const payload = (await response.json()) as Record<string, unknown>;
  const fileId =
    (typeof payload.id === "string" ? payload.id : undefined) ??
    (typeof payload.file_id === "string" ? payload.file_id : undefined);
  if (!response.ok || !fileId) {
    throw new Error(`xAI file upload failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  return {
    fileId,
    processingStatus: toXaiProcessingStatus(payload.processing_status)
  };
}

export async function getXaiFileMetadata(fileId: string): Promise<XaiFileMetadata> {
  const { apiKey, baseUrl } = getXaiConfig();
  const normalizedFileId = fileId.trim();
  if (!normalizedFileId) {
    throw new Error("xAI file metadata requires a file id");
  }

  const response = await fetch(`${baseUrl}/files/${normalizedFileId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`xAI file metadata fetch failed: ${JSON.stringify(payload.error ?? payload)}`);
  }

  const resolvedFileId =
    (typeof payload.file_id === "string" ? payload.file_id : undefined) ??
    (typeof payload.id === "string" ? payload.id : undefined) ??
    normalizedFileId;
  return {
    fileId: resolvedFileId,
    uploadStatus: asString(payload.upload_status),
    uploadErrorMessage: asString(payload.upload_error_message),
    processingStatus: toXaiProcessingStatus(payload.processing_status)
  };
}

export async function chatWithXai(input: {
  model?: string;
  messages: XaiChatMessage[];
  temperature?: number;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: XaiToolChoice;
  parallelism?: XaiParallelismConfig;
}): Promise<XaiChatResult> {
  const { apiKey, baseUrl, defaultModel } = getXaiConfig();
  const toolChoice = input.toolChoice ?? "auto";
  const mappedTools =
    toolChoice !== "none" && input.tools && input.tools.length > 0
      ? toXaiRequestTools(input.tools)
      : [];
  const body: Record<string, unknown> = {
    model: input.model ?? defaultModel,
    messages: input.messages,
    temperature: input.temperature ?? 0.2
  };
  if (mappedTools.length > 0) {
    body.tools = mappedTools;
    body.tool_choice = toolChoice;
  }
  if (input.parallelism) {
    body.agent_count = input.parallelism.agentCount;
    body.reasoning = { effort: input.parallelism.reasoningEffort };
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    error?: unknown;
  };

  if (!response.ok) {
    throw new Error(`xAI chat failed: ${JSON.stringify(payload.error ?? payload)}`);
  }

  const outputText = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!outputText) {
    throw new Error("xAI chat returned an empty response");
  }

  return {
    model: payload.model ?? input.model ?? defaultModel,
    outputText,
    raw: payload
  };
}

export async function respondWithXai(input: {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: XaiToolChoice;
  maxTurns?: number;
  parallelism?: XaiParallelismConfig;
}): Promise<XaiResponsesResult> {
  const { apiKey, baseUrl, defaultModel } = getXaiConfig();
  const tools = toXaiRequestTools(input.tools ?? []);
  const body: Record<string, unknown> = {
    model: input.model ?? defaultModel,
    system_prompt: input.systemPrompt,
    input: input.userPrompt,
    tools,
    tool_choice: input.toolChoice ?? "auto",
    max_turns: input.maxTurns ?? 5
  };
  if (input.parallelism) {
    body.agent_count = input.parallelism.agentCount;
    body.reasoning = { effort: input.parallelism.reasoningEffort };
  }
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(async () => {
    const text = await response.text();
    return { _raw: text || `(empty body, status ${response.status})` };
  })) as Record<string, unknown>;
  if (!response.ok) {
    const errDetail =
      payload.error ?? payload._raw ?? payload;
    throw new Error(
      `xAI responses failed (${response.status} ${response.statusText}): ${JSON.stringify(errDetail)}`
    );
  }

  const outputText = extractResponseOutputText(payload);
  if (!outputText) {
    throw new Error("xAI responses returned an empty response");
  }

  return {
    model: asString(payload.model) ?? input.model ?? defaultModel,
    outputText,
    raw: payload
  };
}

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ result: string; error?: string }>;

export type ToolCallLog = {
  name: string;
  args: Record<string, unknown>;
  result: string;
  error?: string;
  durationMs: number;
};

export type XaiToolLoopResult = {
  model: string;
  outputText: string;
  toolCalls: ToolCallLog[];
  turnsUsed: number;
  raw: unknown;
};

export async function respondWithXaiToolLoop(input: {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  tools: Array<Record<string, unknown>>;
  toolChoice?: XaiToolChoice;
  maxTurns?: number;
  executor: ToolExecutor;
  parallelism?: XaiParallelismConfig;
}): Promise<XaiToolLoopResult> {
  const { apiKey, baseUrl, defaultModel } = getXaiConfig();
  const model = input.model ?? defaultModel;
  const maxTurns = input.maxTurns ?? 5;
  /** Let xAI run built-in tools (web_search, x_search, file_search) server-side inside one HTTP call; `1` broke live search for Super-Agent when mixed with local tools. */
  const perRequestMaxTurns = Math.min(Math.max(maxTurns, 1), 16);
  const toolCalls: ToolCallLog[] = [];
  const tools = toXaiRequestTools(input.tools);

  let conversationInput: unknown = input.userPrompt;
  let turnsUsed = 0;
  let lastPayload: Record<string, unknown> = {};
  /** Required for follow-up `/responses` turns (tool outputs + hosted tools like web_search). */
  let previousResponseId: string | undefined;

  /** Pseudo tool markup recovery may need an extra host round-trip on the last configured turn; cap extensions. */
  const syntheticRecoveryCap = maxTurns + 6;
  let loopLimit = maxTurns;

  for (let turn = 0; turn < loopLimit && turn < syntheticRecoveryCap; turn++) {
    turnsUsed = turn + 1;

    const requestBody: Record<string, unknown> = {
      model,
      system_prompt: input.systemPrompt,
      input: conversationInput,
      tools,
      tool_choice: input.toolChoice ?? "auto",
      max_turns: perRequestMaxTurns
    };
    if (previousResponseId && turn > 0) {
      requestBody.previous_response_id = previousResponseId;
    }
    if (input.parallelism) {
      requestBody.agent_count = input.parallelism.agentCount;
      requestBody.reasoning = { effort: input.parallelism.reasoningEffort };
    }

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const payload = (await response.json().catch(async () => {
      const text = await response.text();
      return { _raw: text || `(empty body, status ${response.status})` };
    })) as Record<string, unknown>;
    lastPayload = payload;

    if (!response.ok) {
      const errDetail = payload.error ?? payload._raw ?? payload;
      throw new Error(
        `xAI responses failed (${response.status} ${response.statusText}): ${JSON.stringify(errDetail)}`
      );
    }

    const responseId = asString(payload.id);
    if (responseId) {
      previousResponseId = responseId;
    }

    const pendingToolCalls = extractToolCalls(payload);
    if (pendingToolCalls.length === 0) {
      const outputText = extractResponseOutputText(payload);
      const syntheticArgsList = listSyntheticAtxfinanceToolArgs(outputText, input.tools);
      if (syntheticArgsList.length > 0) {
        if (turn + 1 >= loopLimit) {
          loopLimit = Math.min(loopLimit + 1, syntheticRecoveryCap);
        }
        const toolResults: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];
        for (let i = 0; i < syntheticArgsList.length; i++) {
          const syntheticArgs = syntheticArgsList[i];
          const syntheticCallId = `synthetic_atxfinance_${turn}_${i}`;
          const start = Date.now();
          let executorResult: { result: string; error?: string };
          try {
            executorResult = await input.executor("atxfinance", syntheticArgs);
          } catch (error) {
            executorResult = {
              result: "",
              error: error instanceof Error ? error.message : "executor_error"
            };
          }
          const durationMs = Date.now() - start;
          toolCalls.push({
            name: "atxfinance",
            args: syntheticArgs,
            result: executorResult.result,
            error: executorResult.error,
            durationMs
          });
          const toolOutput = executorResult.error
            ? JSON.stringify({ error: executorResult.error })
            : executorResult.result;
          toolResults.push({
            type: "function_call_output",
            call_id: syntheticCallId,
            output: toolOutput
          });
        }
        conversationInput = toolResults;
        continue;
      }

      const syntheticWeb =
        trySyntheticXaiToolWebSearchMarkup(outputText, input.tools) ??
        trySyntheticWebSearchJsonPayload(outputText, input.tools);
      if (syntheticWeb) {
        if (turn + 1 >= loopLimit) {
          loopLimit = Math.min(loopLimit + 1, syntheticRecoveryCap);
        }
        const nr = syntheticWeb.numResults;
        conversationInput =
          "Continue using the real web_search tool (do not print XML or JSON tool markup). " +
          `Search the web for: ${syntheticWeb.query}` +
          (nr != null ? ` (use up to ${nr} strong sources if the tool supports a limit).` : ".");
        toolCalls.push({
          name: "web_search",
          args: { query: syntheticWeb.query, ...(nr != null ? { num_results: nr } : {}) },
          result: "",
          durationMs: 0
        });
        continue;
      }

      return {
        model: asString(payload.model) ?? model,
        outputText,
        toolCalls,
        turnsUsed,
        raw: payload
      };
    }

    const toolResults: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];
    for (const toolCall of pendingToolCalls) {
      if (XAI_HOSTED_FUNCTION_NAMES.has(toolCall.name)) {
        toolResults.push({
          type: "function_call_output",
          call_id: toolCall.callId,
          output: "{}"
        });
        toolCalls.push({
          name: toolCall.name,
          args: toolCall.args,
          result: "{}",
          durationMs: 0
        });
        continue;
      }

      const start = Date.now();
      let executorResult: { result: string; error?: string };
      try {
        executorResult = await input.executor(toolCall.name, toolCall.args);
      } catch (error) {
        executorResult = {
          result: "",
          error: error instanceof Error ? error.message : "executor_error"
        };
      }
      const durationMs = Date.now() - start;

      toolCalls.push({
        name: toolCall.name,
        args: toolCall.args,
        result: executorResult.result,
        error: executorResult.error,
        durationMs
      });

      const output = executorResult.error
        ? JSON.stringify({ error: executorResult.error })
        : executorResult.result;

      toolResults.push({
        type: "function_call_output",
        call_id: toolCall.callId,
        output
      });
    }

    conversationInput = toolResults;
  }

  const outputText = extractResponseOutputText(lastPayload);
  return {
    model: asString(lastPayload.model) ?? model,
    outputText,
    toolCalls,
    turnsUsed,
    raw: lastPayload
  };
}

type ParsedToolCall = {
  callId: string;
  name: string;
  args: Record<string, unknown>;
};

/** xAI executes these on the server; the local executor must not treat them as atxfinance ops. */
const XAI_HOSTED_FUNCTION_NAMES = new Set(["web_search", "x_search"]);

/** Matches `ATXFINANCE_TOOL_DEFINITION.function.parameters.properties.operation.enum` — recover when the model prints JSON instead of using API function_call. */
const ATXFINANCE_SYNTHETIC_OPERATIONS = new Set([
  "portfolio_summary",
  "positions_snapshot",
  "watchlist_snapshot",
  "watchlist_add_symbols",
  "watchlist_remove_symbols",
  "account_health",
  "task_status",
  "market_quote"
]);

function syntheticAtxfinanceArgsFromParsedJson(
  obj: Record<string, unknown>
): Record<string, unknown> | null {
  const op = obj.operation;
  if (typeof op !== "string" || !ATXFINANCE_SYNTHETIC_OPERATIONS.has(op)) {
    return null;
  }
  const toolField = obj.tool;
  if (toolField !== undefined && toolField !== "atxfinance") {
    return null;
  }
  const out: Record<string, unknown> = { operation: op };
  if (typeof obj.symbol === "string" && obj.symbol.trim()) {
    out.symbol = obj.symbol.trim();
  }
  if (Array.isArray(obj.symbols)) {
    const syms = obj.symbols.filter((x): x is string => typeof x === "string" && x.trim());
    if (syms.length > 0) {
      out.symbols = syms.map((s) => s.trim());
    }
  }
  return out;
}

function requestToolsIncludeAtxfinance(tools: Array<Record<string, unknown>>): boolean {
  for (const t of tools) {
    const fn = t.function as Record<string, unknown> | undefined;
    const name = fn && typeof fn === "object" ? asString(fn.name) : "";
    if (name === "atxfinance") {
      return true;
    }
  }
  return false;
}

function requestToolsIncludeWebSearch(tools: Array<Record<string, unknown>>): boolean {
  return tools.some((t) => t.type === "web_search");
}

/**
 * Grok sometimes prints pseudo `<xai-tool>…</xai-tool>` instead of a real `web_search` call. Shapes seen:
 * - `<xai-tool call="web_search">{"query":"..."}</xai-tool>` (closing tag may be malformed)
 * - `<xai-tool name="web_search">{"query":"..."}</xai-tool>`
 * - `<xai-tool>{"name":"web_search","params":{"query":"..."}}</xai-tool>` (no `call=` attribute)
 *
 * Bare assistant JSON (no XML) is handled by {@link trySyntheticWebSearchJsonPayload}:
 * - `{"name":"web_search","arguments":{"query":"..."}}`
 */
function trySyntheticXaiToolWebSearchMarkup(
  assistantText: string,
  tools: Array<Record<string, unknown>>
): { query: string; numResults?: number } | null {
  if (!requestToolsIncludeWebSearch(tools) || !assistantText.trim()) {
    return null;
  }
  if (!/<xai-tool/i.test(assistantText)) {
    return null;
  }
  const innerMatch = assistantText.match(/<xai-tool\b[^>]*>([\s\S]*?)<\/\s*xai-tool[^>]*>/i);
  const inner = innerMatch?.[1]?.trim();
  if (!inner) {
    return null;
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(inner) as Record<string, unknown>;
  } catch {
    return null;
  }

  const openTag = assistantText.match(/<xai-tool\b[^>]*>/i)?.[0] ?? "";
  const callAttr = openTag.match(/\bcall\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
  const nameAttr = openTag.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
  const toolAttr = openTag.match(/\btool\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
  const nameField = typeof parsed.name === "string" ? parsed.name.trim().toLowerCase() : "";
  const toolField = typeof parsed.tool === "string" ? parsed.tool.trim().toLowerCase() : "";
  const isWebSearch =
    callAttr === "web_search" ||
    nameAttr === "web_search" ||
    toolAttr === "web_search" ||
    nameField === "web_search" ||
    toolField === "web_search";

  if (!isWebSearch) {
    return null;
  }

  let query = typeof parsed.query === "string" ? parsed.query.trim() : "";
  const paramsRaw = parsed.params;
  if (
    !query &&
    paramsRaw &&
    typeof paramsRaw === "object" &&
    !Array.isArray(paramsRaw)
  ) {
    const p = paramsRaw as Record<string, unknown>;
    query = typeof p.query === "string" ? p.query.trim() : "";
  }
  if (!query) {
    return null;
  }

  let numRaw: unknown = parsed.num_results ?? parsed.numResults;
  if (numRaw === undefined && paramsRaw && typeof paramsRaw === "object" && !Array.isArray(paramsRaw)) {
    const p = paramsRaw as Record<string, unknown>;
    numRaw = p.num_results ?? p.numResults;
  }
  const numResults = asNumber(numRaw);
  return numResults !== undefined && numResults > 0
    ? { query, numResults: Math.min(Math.floor(numResults), 50) }
    : { query };
}

function extractWebSearchQueryFromToolJsonObject(
  obj: Record<string, unknown>
): { query: string; numResults?: number } | null {
  const name = typeof obj.name === "string" ? obj.name.trim().toLowerCase() : "";
  if (name !== "web_search") {
    return null;
  }
  const args = obj.arguments;
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return null;
  }
  const a = args as Record<string, unknown>;
  const query = typeof a.query === "string" ? a.query.trim() : "";
  if (!query) {
    return null;
  }
  const numRaw = a.num_results ?? a.numResults;
  const numResults = asNumber(numRaw);
  return numResults !== undefined && numResults > 0
    ? { query, numResults: Math.min(Math.floor(numResults), 50) }
    : { query };
}

function trySliceBalancedJsonObject(text: string, start: number): string | null {
  if (text[start] !== "{") {
    return null;
  }
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function findWebSearchJsonObjectSlice(text: string): string | null {
  const marker = /"name"\s*:\s*"web_search"/;
  let idx = 0;
  while (idx < text.length) {
    const rel = text.indexOf("{", idx);
    if (rel < 0) {
      return null;
    }
    const slice = trySliceBalancedJsonObject(text, rel);
    if (slice && marker.test(slice)) {
      return slice;
    }
    idx = rel + 1;
  }
  return null;
}

/**
 * Model prints OpenAI-style tool JSON in assistant text instead of a real `function_call`, e.g.
 * `{"name": "web_search", "arguments": {"query": "…"}}` (optionally inside a fenced block or after prose).
 */
function trySyntheticWebSearchJsonPayload(
  assistantText: string,
  tools: Array<Record<string, unknown>>
): { query: string; numResults?: number } | null {
  if (!requestToolsIncludeWebSearch(tools) || !assistantText.trim()) {
    return null;
  }

  const tryParseSlice = (raw: string): { query: string; numResults?: number } | null => {
    const s = raw.trim();
    if (!s.startsWith("{")) {
      return null;
    }
    try {
      const obj = JSON.parse(s) as Record<string, unknown>;
      return extractWebSearchQueryFromToolJsonObject(obj);
    } catch {
      return null;
    }
  };

  const fenced = assistantText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const hit = tryParseSlice(fenced[1]);
    if (hit) {
      return hit;
    }
  }

  const trimmed = assistantText.trim();
  const whole = tryParseSlice(trimmed);
  if (whole) {
    return whole;
  }

  const embedded = findWebSearchJsonObjectSlice(trimmed);
  if (embedded) {
    return tryParseSlice(embedded);
  }

  return null;
}

/**
 * KB-style: model prints multiple `<function_call name="atxfinance">…</function_call>` blocks in one turn.
 * Inner body may be `<argument name="operation">…</argument>` (legacy) or a single JSON object with
 * `operation`, optional `symbol`, and optional `symbols` (watchlist mutations).
 */
function parseAllAtxfinanceXmlFunctionCalls(assistantText: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const blockRe =
    /<function_call\b[^>]*\bname\s*=\s*["']atxfinance["'][^>]*>([\s\S]*?)<\/\s*function_call\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(assistantText)) !== null) {
    const inner = (m[1] ?? "").trim();
    if (inner.startsWith("{")) {
      try {
        const obj = JSON.parse(inner) as Record<string, unknown>;
        const built = syntheticAtxfinanceArgsFromParsedJson(obj);
        if (built) {
          results.push(built);
        }
      } catch {
        /* ignore */
      }
      continue;
    }
    const opBlock = inner.match(
      /<argument\b[^>]*\bname\s*=\s*["']operation["'][^>]*>([\s\S]*?)<\/\s*argument\s*>/i
    );
    const op = opBlock?.[1]?.trim().replace(/\s+/g, "");
    if (!op || !ATXFINANCE_SYNTHETIC_OPERATIONS.has(op)) {
      continue;
    }
    const out: Record<string, unknown> = { operation: op };
    const symBlock = inner.match(
      /<argument\b[^>]*\bname\s*=\s*["']symbol["'][^>]*>([\s\S]*?)<\/\s*argument\s*>/i
    );
    const sym = symBlock?.[1]?.trim();
    if (sym) {
      out.symbol = sym;
    }
    results.push(out);
  }
  return results;
}

/**
 * Some models return ```json { "tool": "atxfinance", "operation": "..." } ``` or one or more XML
 * `<function_call name="atxfinance">…</function_call>` blocks as assistant text instead of emitting
 * API `function_call` items; the host then never runs the executor without this recovery.
 */
function listSyntheticAtxfinanceToolArgs(
  assistantText: string,
  tools: Array<Record<string, unknown>>
): Record<string, unknown>[] {
  if (!requestToolsIncludeAtxfinance(tools) || !assistantText.trim()) {
    return [];
  }
  const fenced = assistantText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonSlice = fenced ? fenced[1].trim() : assistantText.trim();
  if (jsonSlice.startsWith("{")) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(jsonSlice) as Record<string, unknown>;
    } catch {
      const opQuoted = assistantText.match(/"operation"\s*:\s*"([a-z_]+)"/);
      if (!opQuoted?.[1] || !ATXFINANCE_SYNTHETIC_OPERATIONS.has(opQuoted[1])) {
        return [];
      }
      if (!/\batxfinance\b/i.test(assistantText)) {
        return [];
      }
      return [{ operation: opQuoted[1] }];
    }
    const built = syntheticAtxfinanceArgsFromParsedJson(obj);
    return built ? [built] : [];
  }

  const xmlList = parseAllAtxfinanceXmlFunctionCalls(assistantText);
  return xmlList.length > 0 ? xmlList : [];
}

function extractToolCalls(payload: Record<string, unknown>): ParsedToolCall[] {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const calls: ParsedToolCall[] = [];

  for (const entry of output) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (item.type !== "function_call") continue;

    const callId = asString(item.call_id) ?? asString(item.id) ?? "";
    const name = asString(item.name) ?? "";
    let args: Record<string, unknown> = {};

    if (typeof item.arguments === "string") {
      try {
        args = JSON.parse(item.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }
    } else if (item.arguments && typeof item.arguments === "object") {
      args = item.arguments as Record<string, unknown>;
    }

    if (name) {
      calls.push({ callId, name, args });
    }
  }

  return calls;
}

export async function searchDocumentsInCollections(input: {
  query: string;
  collectionIds: string[];
  limit: number;
}): Promise<XaiCollectionSearchSnippet[]> {
  const { apiKey, baseUrl } = getXaiConfig();
  const collectionIds = input.collectionIds.map((value) => value.trim()).filter(Boolean);
  if (collectionIds.length === 0) {
    return [];
  }

  const response = await fetch(`${baseUrl}/documents/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: input.query,
      source: {
        collection_ids: collectionIds
      },
      retrieval_mode: {
        type: "hybrid"
      },
      top_k: input.limit
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`xAI documents search failed: ${JSON.stringify(payload.error ?? payload)}`);
  }

  return extractCollectionSnippets(payload, input.limit);
}

export type XaiCollectionStats = {
  id: string;
  name?: string;
  documentCount?: number;
  chunkCount?: number;
  fileCount?: number;
  indexStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getXaiCollectionById(collectionId: string): Promise<XaiCollectionStats> {
  const { managementApiKey, managementBaseUrl } = getXaiManagementConfig();

  const normalizedId = collectionId.trim();
  const response = await fetch(`${managementBaseUrl}/collections/${normalizedId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${managementApiKey}`
    }
  });

  if (response.status === 404) {
    throw new XaiCollectionNotFoundError(normalizedId);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`xAI collection lookup failed: ${JSON.stringify(payload.error ?? payload)}`);
  }

  const id =
    (typeof payload.id === "string" ? payload.id : undefined) ??
    (typeof payload.collection_id === "string" ? payload.collection_id : undefined) ??
    normalizedId;

  const name =
    (typeof payload.name === "string" ? payload.name : undefined) ??
    (typeof payload.collection_name === "string" ? payload.collection_name : undefined);

  const documentCount =
    asNumber(payload.document_count) ??
    asNumber(payload.documents_count) ??
    asNumber(payload.total_documents) ??
    asNumber(payload.size);
  const chunkCount =
    asNumber(payload.chunk_count) ??
    asNumber(payload.chunks_count) ??
    asNumber(payload.total_chunks) ??
    asNumber(payload.vector_count);
  const fileCount =
    asNumber(payload.file_count) ??
    asNumber(payload.files_count) ??
    asNumber(payload.total_files);
  const indexStatus =
    asString(payload.index_status) ??
    asString(payload.embedding_status) ??
    asString(payload.status);
  const createdAt = asString(payload.created_at) ?? asString(payload.createdAt);
  const updatedAt = asString(payload.updated_at) ?? asString(payload.updatedAt);

  return {
    id,
    name,
    documentCount,
    chunkCount,
    fileCount,
    indexStatus,
    createdAt,
    updatedAt
  };
}

export async function listXaiCollections(): Promise<XaiCollectionInventoryItem[]> {
  const { managementApiKey, managementBaseUrl } = getXaiManagementConfig();

  const response = await fetch(`${managementBaseUrl}/collections`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${managementApiKey}`
    }
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`xAI collections list failed: ${JSON.stringify(payload.error ?? payload)}`);
  }

  const collectionCandidates = [
    payload.data,
    payload.results,
    payload.collections,
    payload.items
  ].find(Array.isArray);

  if (!Array.isArray(collectionCandidates)) {
    return [];
  }

  const collections: XaiCollectionInventoryItem[] = [];
  for (const candidate of collectionCandidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const entry = candidate as Record<string, unknown>;
    const id = asString(entry.id) ?? asString(entry.collection_id);
    if (!id) {
      continue;
    }
    const name = asString(entry.name) ?? asString(entry.collection_name);
    const documentCount =
      asNumber(entry.document_count) ??
      asNumber(entry.documents_count) ??
      asNumber(entry.total_documents) ??
      asNumber(entry.size);
    const createdAt = asString(entry.created_at) ?? asString(entry.createdAt);
    const updatedAt = asString(entry.updated_at) ?? asString(entry.updatedAt);
    collections.push({
      id,
      name,
      documentCount,
      createdAt,
      updatedAt
    });
  }

  return collections;
}

function extractCollectionSnippets(
  payload: Record<string, unknown>,
  maxResults: number
): XaiCollectionSearchSnippet[] {
  const candidates = [
    payload.data,
    payload.results,
    payload.documents,
    payload.matches
  ].find(Array.isArray);

  if (!Array.isArray(candidates)) {
    return [];
  }

  const snippets: XaiCollectionSearchSnippet[] = [];
  for (const candidate of candidates) {
    if (snippets.length >= maxResults) {
      break;
    }
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const entry = candidate as Record<string, unknown>;
    const documentId = asString(entry.id) ?? asString(entry.document_id);
    const documentName = asString(entry.name) ?? asString(entry.title);
    const textCandidates: Array<string | undefined> = [
      asString(entry.text),
      asString(entry.content),
      asString(entry.snippet),
      asString(entry.excerpt)
    ];

    const snippetsArray = Array.isArray(entry.snippets) ? entry.snippets : [];
    for (const snippetEntry of snippetsArray) {
      if (!snippetEntry || typeof snippetEntry !== "object") {
        continue;
      }
      const snippetObject = snippetEntry as Record<string, unknown>;
      textCandidates.push(asString(snippetObject.text) ?? asString(snippetObject.content));
    }

    const chunksArray = Array.isArray(entry.chunks) ? entry.chunks : [];
    for (const chunkEntry of chunksArray) {
      if (!chunkEntry || typeof chunkEntry !== "object") {
        continue;
      }
      const chunkObject = chunkEntry as Record<string, unknown>;
      textCandidates.push(asString(chunkObject.text) ?? asString(chunkObject.content));
    }

    for (const textCandidate of textCandidates) {
      const text = textCandidate?.trim();
      if (!text) {
        continue;
      }
      snippets.push({
        text,
        documentId,
        documentName
      });
      if (snippets.length >= maxResults) {
        break;
      }
    }
  }

  return snippets;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toXaiProcessingStatus(value: unknown): XaiFileProcessingStatus {
  if (typeof value !== "string") {
    return "unknown";
  }
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "pending":
    case "processing":
    case "complete":
    case "failed":
    case "skipped":
      return normalized;
    default:
      return "unknown";
  }
}

function extractResponseOutputText(payload: Record<string, unknown>): string {
  const directText = asString(payload.output_text)?.trim();
  if (directText) {
    return directText;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const fragments: string[] = [];

  for (const entry of output) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const outputEntry = entry as Record<string, unknown>;
    const content = Array.isArray(outputEntry.content) ? outputEntry.content : [];
    for (const piece of content) {
      if (!piece || typeof piece !== "object") {
        continue;
      }
      const contentPiece = piece as Record<string, unknown>;
      const text = asString(contentPiece.text)?.trim();
      if (text) {
        fragments.push(text);
      }
    }
  }

  return fragments.join("\n").trim();
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}
