import { getEnv, XAI_BASE_URL_DEFAULT } from "@/lib/env";

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
  state?: "pending" | "succeeded" | "failed" | "cancelled";
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
    baseUrl: env.XAI_BASE_URL ?? XAI_BASE_URL_DEFAULT
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
  const cancelUrls = [
    `${baseUrl}/batches/${batchId}:cancel`,
    `${baseUrl}/batches/${batchId}/cancel`
  ];

  for (let i = 0; i < cancelUrls.length; i++) {
    const response = await fetch(cancelUrls[i], {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const isLast = i === cancelUrls.length - 1;
      if (!isLast && response.status === 404) {
        continue;
      }
      throw classifyError(response.status, payload);
    }

    return parseBatchJob(payload);
  }

  throw new XaiBatchError({
    message: "xAI batch cancel failed",
    code: "CLIENT_ERROR",
    retryable: false
  });
}

export async function listBatchJobResults(input: {
  batchId: string;
  outputFileId?: string;
  pageSize?: number;
}): Promise<XaiBatchResultItem[]> {
  const { apiKey, baseUrl } = getXaiConfig();
  const pageSize = input.pageSize ?? 200;

  try {
    let paginationToken: string | undefined;
    const results: XaiBatchResultItem[] = [];
    do {
      const url = new URL(`${baseUrl}/batches/${input.batchId}/results`);
      url.searchParams.set("page_size", String(pageSize));
      if (paginationToken) {
        url.searchParams.set("pagination_token", paginationToken);
      }

      const response = await fetch(url.toString(), {
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

      const page = parseBatchResultsPage(payload);
      results.push(...page.items);
      paginationToken = page.paginationToken;
    } while (paginationToken);

    if (results.length > 0 || !input.outputFileId) {
      return results;
    }
  } catch (error) {
    if (!input.outputFileId) {
      throw error;
    }
  }

  return listBatchJobResultsFromOutputFile(input.outputFileId);
}

async function listBatchJobResultsFromOutputFile(
  outputFileId: string
): Promise<XaiBatchResultItem[]> {
  const { apiKey, baseUrl } = getXaiConfig();
  const response = await fetch(`${baseUrl}/files/${outputFileId}/content`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw classifyError(response.status, payload);
  }

  const text = await response.text();
  const lines = text.split("\n").filter(Boolean);
  const results: XaiBatchResultItem[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const normalized = parseBatchResultLike(parsed);
      if (normalized) {
        results.push(normalized);
      }
    } catch {
      // skip malformed lines
    }
  }

  return results;
}

function parseBatchResultsPage(payload: Record<string, unknown>): {
  items: XaiBatchResultItem[];
  paginationToken?: string;
} {
  const toArray = (value: unknown): Array<Record<string, unknown>> =>
    Array.isArray(value)
      ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      : [];

  const succeeded = toArray(payload.succeeded).map((item) =>
    parseBatchResultLike(item, "succeeded")
  );
  const failed = toArray(payload.failed).map((item) =>
    parseBatchResultLike(item, "failed")
  );
  const fromBuckets = [...succeeded, ...failed].filter(
    (item): item is XaiBatchResultItem => Boolean(item)
  );

  const candidateLists = [
    toArray(payload.results),
    toArray(payload.batch_results),
    toArray(payload.data),
    Array.isArray(payload.items)
      ? payload.items.filter(
          (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object"
        )
      : []
  ];

  const directItems =
    fromBuckets.length > 0
      ? []
      : candidateLists
          .flatMap((list) => list)
          .map((item) => parseBatchResultLike(item))
          .filter((item): item is XaiBatchResultItem => Boolean(item));

  const paginationTokenCandidate =
    typeof payload.pagination_token === "string"
      ? payload.pagination_token
      : typeof payload.next_page_token === "string"
        ? payload.next_page_token
        : undefined;

  return {
    items: fromBuckets.length > 0 ? fromBuckets : directItems,
    paginationToken: paginationTokenCandidate && paginationTokenCandidate.trim() ? paginationTokenCandidate : undefined
  };
}

function parseBatchResultLike(
  raw: Record<string, unknown>,
  forcedState?: XaiBatchResultItem["state"]
): XaiBatchResultItem | null {
  const customIdCandidate =
    typeof raw.custom_id === "string"
      ? raw.custom_id
      : typeof raw.batch_request_id === "string"
        ? raw.batch_request_id
        : undefined;
  if (!customIdCandidate) return null;

  const stateCandidate =
    forcedState ??
    (typeof raw.state === "string" && isValidRequestState(raw.state)
      ? raw.state
      : undefined);

  let response: XaiBatchResultItem["response"];
  const rawResponse = raw.response;
  if (rawResponse && typeof rawResponse === "object") {
    const responseObj = rawResponse as Record<string, unknown>;
    if (typeof responseObj.status_code === "number") {
      response = {
        status_code: responseObj.status_code,
        body:
          responseObj.body && typeof responseObj.body === "object"
            ? (responseObj.body as Record<string, unknown>)
            : {}
      };
    } else {
      const completionResponse =
        responseObj.completion_response && typeof responseObj.completion_response === "object"
          ? (responseObj.completion_response as Record<string, unknown>)
          : responseObj;
      response = {
        status_code: 200,
        body: completionResponse
      };
    }
  }

  let error: XaiBatchResultItem["error"];
  if (raw.error && typeof raw.error === "object") {
    const rawErr = raw.error as Record<string, unknown>;
    error = {
      code: typeof rawErr.code === "string" ? rawErr.code : "batch_error",
      message: typeof rawErr.message === "string" ? rawErr.message : JSON.stringify(rawErr)
    };
  } else if (typeof raw.error_message === "string" && raw.error_message.trim()) {
    error = {
      code: "batch_error",
      message: raw.error_message
    };
  }

  return {
    custom_id: customIdCandidate,
    state: stateCandidate,
    response,
    error
  };
}

function parseBatchJob(payload: Record<string, unknown>): XaiBatchJob {
  const id =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.batch_id === "string"
        ? payload.batch_id
        : "";
  const inferredStatus = inferStatusFromState(payload.state);
  const rawStatus =
    typeof payload.status === "string"
      ? payload.status
      : inferredStatus ?? "queued";
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
    request_counts: parseRequestCounts(payload.request_counts ?? payload.state),
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
  const totalCandidate =
    typeof counts.total === "number"
      ? counts.total
      : typeof counts.num_requests === "number"
        ? counts.num_requests
        : 0;
  const completedCandidate =
    typeof counts.completed === "number"
      ? counts.completed
      : typeof counts.num_success === "number"
        ? counts.num_success
        : 0;
  const failedCandidate =
    typeof counts.failed === "number"
      ? counts.failed
      : typeof counts.num_error === "number"
        ? counts.num_error
        : 0;
  const total = Math.max(0, totalCandidate);
  const completed = Math.max(0, completedCandidate);
  const failed = Math.max(0, failedCandidate);
  if (total === 0 && completed === 0 && failed === 0) {
    return undefined;
  }
  return { total, completed, failed };
}

function isValidBatchStatus(value: string): value is XaiBatchJobStatus {
  return (
    ["queued", "in_progress", "completed", "failed", "cancelled", "expired"] as string[]
  ).includes(value);
}

function isValidRequestState(
  value: string
): value is NonNullable<XaiBatchResultItem["state"]> {
  return (["pending", "succeeded", "failed", "cancelled"] as string[]).includes(value);
}

function inferStatusFromState(raw: unknown): XaiBatchJobStatus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const state = raw as Record<string, unknown>;
  const pending =
    typeof state.num_pending === "number"
      ? state.num_pending
      : undefined;
  const requests =
    typeof state.num_requests === "number"
      ? state.num_requests
      : undefined;
  if (typeof pending === "number") {
    if (pending > 0) {
      return "in_progress";
    }
    if (typeof requests === "number" && requests > 0) {
      return "completed";
    }
  }
  return undefined;
}
