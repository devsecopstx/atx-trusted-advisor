import { describe, expect, it, vi } from "vitest";

import type { XaiBatchRequestItem } from "@/lib/xai-batch";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    XAI_API_KEY: "test-key",
    XAI_BASE_URL: "https://api.x.ai/v1",
    XAI_MANAGEMENT_API_KEY: "test-mgmt-key",
    XAI_MANAGEMENT_BASE_URL: "https://management-api.x.ai/v1",
    X_OAUTH_CLIENT_ID: "test-client-id",
    X_OAUTH_CLIENT_SECRET: "test-client-secret"
  })
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("xai batch client", () => {
  it("uploadBatchInputFile sends JSONL and returns fileId", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "file_batch_123" })
    });

    const { uploadBatchInputFile } = await import("@/lib/xai-batch");
    const items: XaiBatchRequestItem[] = [
      {
        custom_id: "item-1",
        method: "POST",
        url: "/v1/responses",
        body: { model: "grok-4-1-fast", input: "Hello" }
      }
    ];

    const result = await uploadBatchInputFile(items);
    expect(result.fileId).toBe("file_batch_123");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/files");
    expect(options.method).toBe("POST");
  });

  it("uploadBatchInputFile throws on empty items", async () => {
    const { uploadBatchInputFile } = await import("@/lib/xai-batch");
    await expect(uploadBatchInputFile([])).rejects.toThrow(
      "at least one request item"
    );
  });

  it("createBatchJob sends correct payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "batch_abc",
        status: "queued",
        input_file_id: "file_123"
      })
    });

    const { createBatchJob } = await import("@/lib/xai-batch");
    const result = await createBatchJob({
      inputFileId: "file_123",
      endpoint: "/v1/responses",
      metadata: { personaId: "p1" }
    });

    expect(result.id).toBe("batch_abc");
    expect(result.status).toBe("queued");
  });

  it("getBatchJobStatus parses response correctly", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "batch_abc",
        status: "completed",
        output_file_id: "file_out_456",
        request_counts: { total: 5, completed: 4, failed: 1 }
      })
    });

    const { getBatchJobStatus } = await import("@/lib/xai-batch");
    const result = await getBatchJobStatus("batch_abc");

    expect(result.status).toBe("completed");
    expect(result.output_file_id).toBe("file_out_456");
    expect(result.request_counts).toEqual({
      total: 5,
      completed: 4,
      failed: 1
    });
  });

  it("classifies 429 as retryable", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate limited" })
    });

    const { getBatchJobStatus, XaiBatchError } = await import(
      "@/lib/xai-batch"
    );

    try {
      await getBatchJobStatus("batch_xyz");
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(XaiBatchError);
      expect((error as InstanceType<typeof XaiBatchError>).retryable).toBe(
        true
      );
      expect((error as InstanceType<typeof XaiBatchError>).code).toBe(
        "RATE_LIMITED"
      );
    }
  });

  it("classifies 401 as non-retryable", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" })
    });

    const { createBatchJob, XaiBatchError } = await import(
      "@/lib/xai-batch"
    );

    try {
      await createBatchJob({
        inputFileId: "file_x",
        endpoint: "/v1/responses"
      });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(XaiBatchError);
      expect((error as InstanceType<typeof XaiBatchError>).retryable).toBe(
        false
      );
    }
  });

  it("listBatchJobResults parses JSONL output", async () => {
    const jsonl = [
      JSON.stringify({
        custom_id: "item-1",
        response: {
          status_code: 200,
          body: { output_text: "Hello back" }
        }
      }),
      JSON.stringify({
        custom_id: "item-2",
        error: { code: "server_error", message: "internal" }
      })
    ].join("\n");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => jsonl
    });

    const { listBatchJobResults } = await import("@/lib/xai-batch");
    const results = await listBatchJobResults("file_out_123");

    expect(results).toHaveLength(2);
    expect(results[0].custom_id).toBe("item-1");
    expect(results[0].response?.body.output_text).toBe("Hello back");
    expect(results[1].custom_id).toBe("item-2");
    expect(results[1].error?.message).toBe("internal");
  });

  it("isBatchJobTerminal correctly identifies terminal states", async () => {
    const { isBatchJobTerminal } = await import("@/lib/xai-batch");
    expect(isBatchJobTerminal("completed")).toBe(true);
    expect(isBatchJobTerminal("failed")).toBe(true);
    expect(isBatchJobTerminal("cancelled")).toBe(true);
    expect(isBatchJobTerminal("expired")).toBe(true);
    expect(isBatchJobTerminal("queued")).toBe(false);
    expect(isBatchJobTerminal("in_progress")).toBe(false);
  });
});
