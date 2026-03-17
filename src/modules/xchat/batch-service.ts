import { ObjectId } from "mongodb";

import {
  type XaiBatchJob,
  type XaiBatchRequestItem,
  type XaiBatchResultItem,
  createBatchJob,
  getBatchJobStatus,
  isBatchJobTerminal,
  listBatchJobResults,
  uploadBatchInputFile
} from "@/lib/xai-batch";
import { searchDocumentsInCollections } from "@/lib/xai";
import { getDb } from "@/lib/mongodb";
import { normalizePersonaXapiConfig, type PersonaConfig } from "@/modules/xchat/types";

const BATCH_JOBS_COLLECTION = "xchat_batch_jobs";
const BATCH_ITEMS_COLLECTION = "xchat_batch_items";
const MAX_ITEMS_PER_BATCH = 500;
const POLL_INTERVAL_MS = 15_000;
const MAX_POLL_ATTEMPTS = 200;

export type BatchWorkloadItem = {
  itemId: string;
  message: string;
  scope?: string;
};

export type BatchSubmitInput = {
  personaId: string;
  persona: PersonaConfig;
  items: BatchWorkloadItem[];
  userId: string;
  tenantId?: string;
  submittedBy: string;
};

export type BatchJobRecord = {
  _id?: ObjectId;
  xaiBatchId: string;
  personaId: string;
  personaName: string;
  status: string;
  itemCount: number;
  completedCount: number;
  failedCount: number;
  userId: string;
  tenantId?: string;
  submittedBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, string>;
};

export type BatchItemRecord = {
  _id?: ObjectId;
  batchJobId: ObjectId;
  xaiBatchId: string;
  itemId: string;
  message: string;
  scope: string;
  ragContext?: string;
  responseText?: string;
  status: "pending" | "completed" | "failed";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function submitBatchJob(
  input: BatchSubmitInput
): Promise<BatchJobRecord> {
  if (input.items.length === 0) {
    throw new Error("Batch must contain at least one item");
  }
  if (input.items.length > MAX_ITEMS_PER_BATCH) {
    throw new Error(`Batch exceeds maximum of ${MAX_ITEMS_PER_BATCH} items`);
  }

  const seenIds = new Set<string>();
  for (const item of input.items) {
    if (seenIds.has(item.itemId)) {
      throw new Error(`Duplicate itemId: ${item.itemId}`);
    }
    seenIds.add(item.itemId);
  }

  const xapiConfig = normalizePersonaXapiConfig(input.persona.xapi);
  const collectionId = input.persona.xaiCollection?.collectionId?.trim();
  const endpoint =
    xapiConfig.mode === "chat_completions"
      ? "/v1/chat/completions"
      : "/v1/responses";

  const batchRequestItems: XaiBatchRequestItem[] = [];
  const itemContextMap = new Map<string, string>();

  for (const item of input.items) {
    let ragContext = "";

    if (input.persona.enableRag !== false && collectionId) {
      try {
        const snippets = await searchDocumentsInCollections({
          query: item.message,
          collectionIds: [collectionId],
          limit: 4
        });
        if (snippets.length > 0) {
          ragContext = snippets
            .map(
              (s, i) =>
                `[#${i + 1}] (${s.documentName ?? s.documentId ?? "doc"}) ${s.text}`
            )
            .join("\n\n");
        }
      } catch (error) {
        console.error(
          `[xchat/batch] collection pre-search failed for item ${item.itemId}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    itemContextMap.set(item.itemId, ragContext);

    const systemPrompt = [
      input.persona.systemPrompt ??
        "You are xchat, an operations-focused assistant for xfinance core admins.",
      ragContext
        ? `Use the following RAG context if relevant:\n${ragContext}`
        : "No RAG context available."
    ].join("\n\n");

    const userPrompt = input.persona.overridePrompt?.trim()
      ? `${input.persona.overridePrompt}\n\nUser message:\n${item.message}`
      : item.message;

    const body: Record<string, unknown> =
      xapiConfig.mode === "chat_completions"
        ? {
            model: input.persona.model ?? "grok-4-1-fast",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: input.persona.temperature ?? 0.2
          }
        : {
            model: input.persona.model ?? "grok-4-1-fast",
            system_prompt: systemPrompt,
            input: userPrompt,
            tools: xapiConfig.tools,
            tool_choice: xapiConfig.toolChoice,
            max_turns: xapiConfig.maxTurns
          };

    batchRequestItems.push({
      custom_id: item.itemId,
      method: "POST",
      url: endpoint,
      body
    });
  }

  const { fileId } = await uploadBatchInputFile(batchRequestItems);
  const batchJob = await createBatchJob({
    inputFileId: fileId,
    endpoint: endpoint as "/v1/chat/completions" | "/v1/responses",
    metadata: {
      personaId: input.personaId,
      personaName: input.persona.name,
      submittedBy: input.submittedBy
    }
  });

  const db = await getDb();
  const now = new Date();

  const jobRecord: BatchJobRecord = {
    xaiBatchId: batchJob.id,
    personaId: input.personaId,
    personaName: input.persona.name,
    status: batchJob.status,
    itemCount: input.items.length,
    completedCount: 0,
    failedCount: 0,
    userId: input.userId,
    tenantId: input.tenantId,
    submittedBy: input.submittedBy,
    createdAt: now,
    updatedAt: now,
    metadata: batchJob.metadata
  };

  const jobInsert = await db
    .collection<BatchJobRecord>(BATCH_JOBS_COLLECTION)
    .insertOne(jobRecord);
  jobRecord._id = jobInsert.insertedId;

  const itemDocs: BatchItemRecord[] = input.items.map((item) => ({
    batchJobId: jobInsert.insertedId,
    xaiBatchId: batchJob.id,
    itemId: item.itemId,
    message: item.message,
    scope: item.scope ?? input.persona.defaultScope ?? "global",
    ragContext: itemContextMap.get(item.itemId) || undefined,
    status: "pending" as const,
    createdAt: now,
    updatedAt: now
  }));

  if (itemDocs.length > 0) {
    await db
      .collection<BatchItemRecord>(BATCH_ITEMS_COLLECTION)
      .insertMany(itemDocs);
  }

  return jobRecord;
}

export async function pollBatchJob(
  xaiBatchId: string
): Promise<BatchJobRecord> {
  const db = await getDb();
  const jobRecord = await db
    .collection<BatchJobRecord>(BATCH_JOBS_COLLECTION)
    .findOne({ xaiBatchId });

  if (!jobRecord) {
    throw new Error(`Batch job not found: ${xaiBatchId}`);
  }

  if (isBatchJobTerminal(jobRecord.status as XaiBatchJob["status"])) {
    return jobRecord;
  }

  const batchJob = await getBatchJobStatus(xaiBatchId);

  const updates: Partial<BatchJobRecord> = {
    status: batchJob.status,
    updatedAt: new Date()
  };

  if (batchJob.request_counts) {
    updates.completedCount = batchJob.request_counts.completed;
    updates.failedCount = batchJob.request_counts.failed;
  }

  if (
    batchJob.status === "completed" &&
    batchJob.output_file_id
  ) {
    updates.completedAt = new Date();
    await correlateResults(
      xaiBatchId,
      batchJob.output_file_id,
      jobRecord._id!
    );
  }

  if (batchJob.status === "failed") {
    updates.completedAt = new Date();
  }

  await db
    .collection<BatchJobRecord>(BATCH_JOBS_COLLECTION)
    .updateOne({ xaiBatchId }, { $set: updates });

  return { ...jobRecord, ...updates };
}

export async function pollBatchJobUntilDone(
  xaiBatchId: string
): Promise<BatchJobRecord> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const record = await pollBatchJob(xaiBatchId);
    if (isBatchJobTerminal(record.status as XaiBatchJob["status"])) {
      return record;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Batch job ${xaiBatchId} did not complete within polling limit`
  );
}

export async function getBatchJobRecord(
  xaiBatchId: string
): Promise<BatchJobRecord | null> {
  const db = await getDb();
  return db
    .collection<BatchJobRecord>(BATCH_JOBS_COLLECTION)
    .findOne({ xaiBatchId });
}

export async function listBatchJobs(input: {
  tenantId?: string;
  limit?: number;
}): Promise<BatchJobRecord[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (input.tenantId) {
    query.tenantId = input.tenantId;
  }
  return db
    .collection<BatchJobRecord>(BATCH_JOBS_COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(input.limit ?? 50)
    .toArray();
}

export async function listBatchItemResults(
  xaiBatchId: string
): Promise<BatchItemRecord[]> {
  const db = await getDb();
  return db
    .collection<BatchItemRecord>(BATCH_ITEMS_COLLECTION)
    .find({ xaiBatchId })
    .sort({ itemId: 1 })
    .toArray();
}

async function correlateResults(
  xaiBatchId: string,
  outputFileId: string,
  batchJobId: ObjectId
): Promise<void> {
  const results = await listBatchJobResults(outputFileId);
  const db = await getDb();
  const now = new Date();

  for (const result of results) {
    const responseText = extractOutputText(result);
    const errorMessage = result.error?.message;
    const status: BatchItemRecord["status"] =
      result.response?.status_code === 200 && responseText
        ? "completed"
        : "failed";

    await db
      .collection<BatchItemRecord>(BATCH_ITEMS_COLLECTION)
      .updateOne(
        { batchJobId, itemId: result.custom_id },
        {
          $set: {
            responseText: responseText || undefined,
            status,
            errorMessage: errorMessage || undefined,
            updatedAt: now
          }
        }
      );
  }
}

function extractOutputText(result: XaiBatchResultItem): string {
  if (!result.response?.body) return "";
  const body = result.response.body;

  const directText =
    typeof body.output_text === "string" ? body.output_text.trim() : "";
  if (directText) return directText;

  const choices = Array.isArray(body.choices) ? body.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const msg = (choice as Record<string, unknown>).message;
    if (!msg || typeof msg !== "object") continue;
    const content = (msg as Record<string, unknown>).content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
  }

  const output = Array.isArray(body.output) ? body.output : [];
  const fragments: string[] = [];
  for (const entry of output) {
    if (!entry || typeof entry !== "object") continue;
    const contentArr = Array.isArray(
      (entry as Record<string, unknown>).content
    )
      ? ((entry as Record<string, unknown>).content as unknown[])
      : [];
    for (const piece of contentArr) {
      if (!piece || typeof piece !== "object") continue;
      const text = (piece as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) {
        fragments.push(text.trim());
      }
    }
  }

  return fragments.join("\n").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
