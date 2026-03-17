import { getEnv } from "@/lib/env";

export type XaiBatchJobStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type XaiBatchRequestItem = {
  custom_id: string;
  method: "POST";
  url: string;
  body: Record<string, unknown>;
};

export type XaiBatchJob = {
  id: string;
  status: XaiBatchJobStatus;
  input_file_id?: string;
  output_file_id?: string;
  error_file_id?: string;
  created_at?: string;
  completed_at?: string;
  failed_at?: string;
  request_counts?: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: Record<string, string>;
};

export type XaiBatchResultItem = {
  custom_id: string;
  response?: {
    status_code: number;
    body: Record<string, unknown>;
  };
  error?: {
    code: string;
    message: string;
  };
};

export class XaiBatchError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(input: {
    message: string;
    code: string;
    retryable: boolean;
    statusCode?: number;
  }) {
    super(input.message);
    this.name = "XaiBatchError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.statusCode = input.statusCode;
  }
}

const TERMINAL_STATUSES = new Set<XaiBatchJobStatus>([
  "completed",
  "failed",
  "cancelled",
  "expired"
]);

export function isBatchJobTerminal(status: XaiBatchJobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

function getXaiConfig() {
  const env = getEnv();
  return {
    apiKey: env.XAI_API_KEY,
    baseUrl: env.XAI_BASE_URL ?? "https://api.x.ai/v1"
  };
}

function classifyError(
  statusCode: number,
  payload: Record<string, unknown>
): XaiBatchError {
  const message =
    typeof payload.error === "string"
      ? payload.error
      : typeof payload.message === "string"
        ? payload.message
        : JSON.stringify(payload.error ?? payload);

  if (statusCode === 429 || statusCode >= 500) {
    return new XaiBatchError({
      message: `xAI batch API error (${statusCode}): ${message}`,
      code: statusCode === 429 ? "RATE_LIMITED" : "SERVER_ERROR",
      retryable: true,
      statusCode
    });
  }

  return new XaiBatchError({
    message: `xAI batch API error (${statusCode}): ${message}`,
    code: statusCode === 401 ? "UNAUTHORIZED" : "CLIENT_ERROR",
    retryable: false,
    statusCode
  });
}

export async function uploadBatchInputFile(
  items: XaiBatchRequestItem[]
): Promise<{ fileId: string }> {
  if (items.length === 0) {
    throw new XaiBatchError({
      message: "Batch input must contain at least one request item",
      code: "EMPTY_INPUT",
      retryable: false
    });
  }

  const { apiKey, baseUrl } = getXaiConfig();
  const jsonl = items.map((item) => JSON.stringify(item)).join("\n");
  const blob = new Blob([jsonl], { type: "application/jsonl" });
  const formData = new FormData();
  formData.set("file", blob, "batch-input.jsonl");
  formData.set("purpose", "batch");

  const response = await fetch(`${baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw classifyError(response.status, payload);
  }

  const fileId =
    typeof payload.id === "string" ? payload.id : undefined;
  if (!fileId) {
    throw new XaiBatchError({
      message: "xAI batch file upload returned no file id",
      code: "MISSING_FILE_ID",
      retryable: false
    });
  }
  return { fileId };
}

export async function createBatchJob(input: {
  inputFileId: string;
  endpoint: "/v1/chat/completions" | "/v1/responses";
  metadata?: Record<string, string>;
}): Promise<XaiBatchJob> {
  const { apiKey, baseUrl } = getXaiConfig();

  const response = await fetch(`${baseUrl}/batches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input_file_id: input.inputFileId,
      endpoint: input.endpoint,
      completion_window: "24h",
      metadata: input.metadata
    })
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw classifyError(response.status, payload);
  }

  return parseBatchJob(payload);
}

export async function getBatchJobStatus(
  batchId: string
): Promise<XaiBatchJob> {
  const { apiKey, baseUrl } = getXaiConfig();

  const response = await fetch(`${baseUrl}/batches/${batchId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw classifyError(response.status, payload);
  }

  return parseBatchJob(payload);
}

export async function cancelBatchJob(batchId: string): Promise<XaiBatchJob> {
  const { apiKey, baseUrl } = getXaiConfig();

  const response = await fetch(`${baseUrl}/batches/${batchId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw classifyError(response.status, payload);
  }

  return parseBatchJob(payload);
}

export async function listBatchJobResults(
  outputFileId: string
): Promise<XaiBatchResultItem[]> {
  const { apiKey, baseUrl } = getXaiConfig();

  const response = await fetch(`${baseUrl}/files/${outputFileId}/content`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    throw classifyError(response.status, payload);
  }

  const text = await response.text();
  const lines = text.split("\n").filter(Boolean);
  const results: XaiBatchResultItem[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as XaiBatchResultItem;
      if (typeof parsed.custom_id === "string") {
        results.push(parsed);
      }
    } catch {
      // skip malformed lines
    }
  }

  return results;
}

function parseBatchJob(payload: Record<string, unknown>): XaiBatchJob {
  const id = typeof payload.id === "string" ? payload.id : "";
  const rawStatus = typeof payload.status === "string" ? payload.status : "queued";
  const status = isValidBatchStatus(rawStatus) ? rawStatus : "queued";

  return {
    id,
    status,
    input_file_id:
      typeof payload.input_file_id === "string"
        ? payload.input_file_id
        : undefined,
    output_file_id:
      typeof payload.output_file_id === "string"
        ? payload.output_file_id
        : undefined,
    error_file_id:
      typeof payload.error_file_id === "string"
        ? payload.error_file_id
        : undefined,
    created_at:
      typeof payload.created_at === "string"
        ? payload.created_at
        : undefined,
    completed_at:
      typeof payload.completed_at === "string"
        ? payload.completed_at
        : undefined,
    failed_at:
      typeof payload.failed_at === "string" ? payload.failed_at : undefined,
    request_counts: parseRequestCounts(payload.request_counts),
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, string>)
        : undefined
  };
}

function parseRequestCounts(
  raw: unknown
): { total: number; completed: number; failed: number } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const counts = raw as Record<string, unknown>;
  const total = typeof counts.total === "number" ? counts.total : 0;
  const completed =
    typeof counts.completed === "number" ? counts.completed : 0;
  const failed = typeof counts.failed === "number" ? counts.failed : 0;
  return { total, completed, failed };
}

function isValidBatchStatus(value: string): value is XaiBatchJobStatus {
  return (
    ["queued", "in_progress", "completed", "failed", "cancelled", "expired"] as string[]
  ).includes(value);
}
