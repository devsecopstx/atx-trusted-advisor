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

function getXaiConfig() {
  const env = getEnv();
  return {
    apiKey: env.XAI_API_KEY,
    baseUrl: env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    defaultModel: env.XAI_CHAT_MODEL ?? "grok-4-1-fast"
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
): Promise<{ fileId: string }> {
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

  const payload = (await response.json()) as { id?: string; error?: unknown };
  if (!response.ok || !payload.id) {
    throw new Error(`xAI file upload failed: ${JSON.stringify(payload.error ?? payload)}`);
  }
  return { fileId: payload.id };
}

export async function chatWithXai(input: {
  model?: string;
  messages: XaiChatMessage[];
  temperature?: number;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: XaiToolChoice;
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
}): Promise<XaiResponsesResult> {
  const { apiKey, baseUrl, defaultModel } = getXaiConfig();
  const tools = toXaiRequestTools(input.tools ?? []);
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model ?? defaultModel,
      system_prompt: input.systemPrompt,
      input: input.userPrompt,
      tools,
      tool_choice: input.toolChoice ?? "auto",
      max_turns: input.maxTurns ?? 5
    })
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
}): Promise<XaiToolLoopResult> {
  const { apiKey, baseUrl, defaultModel } = getXaiConfig();
  const model = input.model ?? defaultModel;
  const maxTurns = input.maxTurns ?? 5;
  const toolCalls: ToolCallLog[] = [];
  const tools = toXaiRequestTools(input.tools);

  let conversationInput: unknown = input.userPrompt;
  let turnsUsed = 0;
  let lastPayload: Record<string, unknown> = {};

  for (let turn = 0; turn < maxTurns; turn++) {
    turnsUsed = turn + 1;

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        system_prompt: input.systemPrompt,
        input: conversationInput,
        tools,
        tool_choice: input.toolChoice ?? "auto",
        max_turns: 1
      })
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

    const pendingToolCalls = extractToolCalls(payload);
    if (pendingToolCalls.length === 0) {
      const outputText = extractResponseOutputText(payload);
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
