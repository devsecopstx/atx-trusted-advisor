import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const readinessMocks = vi.hoisted(() => ({
  pollRagFileReadiness: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/xchat/rag-file-readiness", () => readinessMocks);
vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    // Keep this suite hermetic: never proxy to backend in integration tests.
    proxyAdminUsersRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});

import { GET as getReadiness } from "@/app/api/rag/files/[fileId]/readiness/route";

describe("rag file readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    readinessMocks.pollRagFileReadiness.mockResolvedValue({
      fileId: "507f1f77bcf86cd799439066",
      xaiFileId: "file_abc",
      readiness: "ready",
      processingStatus: "complete",
      checkedAt: "2026-03-20T00:00:00.000Z"
    });
  });

  it("returns readiness payload for valid file id", async () => {
    const response = await getReadiness(new Request("http://test"), {
      params: Promise.resolve({ fileId: "507f1f77bcf86cd799439066" })
    });
    const payload = (await response.json()) as {
      data: { readiness: string; processingStatus: string };
    };

    expect(response.status).toBe(200);
    expect(payload.data.readiness).toBe("ready");
    expect(payload.data.processingStatus).toBe("complete");
  });

  it("returns 400 for invalid file id", async () => {
    const response = await getReadiness(new Request("http://test"), {
      params: Promise.resolve({ fileId: "not-an-object-id" })
    });
    expect(response.status).toBe(400);
    expect(readinessMocks.pollRagFileReadiness).not.toHaveBeenCalled();
  });

  it("returns 404 when rag file is missing", async () => {
    readinessMocks.pollRagFileReadiness.mockResolvedValueOnce(null);
    const response = await getReadiness(new Request("http://test"), {
      params: Promise.resolve({ fileId: "507f1f77bcf86cd799439099" })
    });
    expect(response.status).toBe(404);
  });

  it("returns auth response when unauthorized", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await getReadiness(new Request("http://test"), {
      params: Promise.resolve({ fileId: "507f1f77bcf86cd799439066" })
    });
    expect(response.status).toBe(401);
  });
});
