import { getEnv } from "@/lib/env";

type XaiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type XaiChatResult = {
  model: string;
  outputText: string;
  raw: unknown;
};

type XaiCollectionSearchSnippet = {
  text: string;
  documentId?: string;
  documentName?: string;
};

function getXaiConfig() {
  const env = getEnv();
  return {
    apiKey: env.XAI_API_KEY,
    baseUrl: env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    defaultModel: env.XAI_CHAT_MODEL ?? "grok-4-latest"
  };
}

function getXaiManagementConfig() {
  const env = getEnv();
  return {
    managementApiKey: env.XAI_MANAGEMENT_API_KEY,
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
  return Boolean(managementApiKey?.trim());
}

export async function createXaiCollection(collectionName: string): Promise<{
  id: string;
  name: string;
}> {
  const { managementApiKey, managementBaseUrl } = getXaiManagementConfig();
  if (!managementApiKey) {
    throw new Error("Missing XAI_MANAGEMENT_API_KEY");
  }

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
  if (!managementApiKey) {
    throw new Error("Missing XAI_MANAGEMENT_API_KEY");
  }

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
}): Promise<XaiChatResult> {
  const { apiKey, baseUrl, defaultModel } = getXaiConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model ?? defaultModel,
      messages: input.messages,
      temperature: input.temperature ?? 0.2
    })
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

export async function getXaiCollectionById(collectionId: string): Promise<{
  id: string;
  name?: string;
}> {
  const { managementApiKey, managementBaseUrl } = getXaiManagementConfig();
  if (!managementApiKey) {
    throw new Error("Missing XAI_MANAGEMENT_API_KEY");
  }

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

  return { id, name };
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
