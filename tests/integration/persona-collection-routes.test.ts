import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiAuthMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const xaiMocks = vi.hoisted(() => ({
  createXaiCollection: vi.fn(),
  addFileToXaiCollection: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  getPersonaById: vi.fn(),
  updatePersona: vi.fn(),
  listRagFiles: vi.fn()
}));

vi.mock("@/lib/api-auth", () => apiAuthMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/xchat/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/repository")>();
  return { ...actual, ...repositoryMocks };
});

import { POST as postCreateCollection } from "@/app/api/personas/[personaId]/collection/create/route";
import { POST as postLinkFiles } from "@/app/api/personas/[personaId]/collection/link-files/route";

describe("persona collection routes", () => {
  beforeEach(() => {
    apiAuthMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    repositoryMocks.getPersonaById.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439055"),
      name: "Ops",
      xaiCollection: {
        collectionId: "collection_ops-global",
        collectionName: "Ops Global Docs"
      },
      defaultScope: "global"
    });
    repositoryMocks.updatePersona.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439055")
    });
    xaiMocks.createXaiCollection.mockResolvedValue({
      id: "collection_newly-created",
      name: "Ops Knowledge Base"
    });
    repositoryMocks.listRagFiles.mockResolvedValue([
      {
        _id: new ObjectId("507f1f77bcf86cd799439066"),
        xaiUploadStatus: "uploaded",
        xaiProcessingStatus: "complete",
        xaiFileId: "file_abc",
        scope: "global"
      },
      {
        _id: new ObjectId("507f1f77bcf86cd799439067"),
        xaiUploadStatus: "failed",
        xaiFileId: undefined,
        scope: "global"
      }
    ]);
    xaiMocks.addFileToXaiCollection.mockResolvedValue({
      linked: true,
      alreadyLinked: false
    });
  });

  it("creates xAI collection and associates to persona", async () => {
    const response = await postCreateCollection(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    const payload = (await response.json()) as { data: { collectionId: string } };

    expect(response.status).toBe(200);
    expect(payload.data.collectionId).toBe("collection_newly-created");
    expect(xaiMocks.createXaiCollection).toHaveBeenCalledWith("Ops Knowledge Base");
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.objectContaining({
        xaiCollection: {
          collectionId: "collection_newly-created",
          collectionName: "Ops Knowledge Base"
        }
      })
    );
  });

  it("links uploaded scope files to persona collection", async () => {
    const response = await postLinkFiles(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    const payload = (await response.json()) as {
      data: { candidateFiles: number; linkedCount: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data.candidateFiles).toBe(1);
    expect(payload.data.linkedCount).toBe(1);
    expect(xaiMocks.addFileToXaiCollection).toHaveBeenCalledWith({
      collectionId: "collection_ops-global",
      fileId: "file_abc"
    });
  });

  it("links only selected files when file ids are provided", async () => {
    repositoryMocks.listRagFiles.mockResolvedValueOnce([
      {
        _id: new ObjectId("507f1f77bcf86cd799439066"),
        xaiUploadStatus: "uploaded",
        xaiProcessingStatus: "complete",
        xaiFileId: "file_abc",
        scope: "global"
      },
      {
        _id: new ObjectId("507f1f77bcf86cd799439068"),
        xaiUploadStatus: "uploaded",
        xaiProcessingStatus: "complete",
        xaiFileId: "file_xyz",
        scope: "global"
      }
    ]);

    const response = await postLinkFiles(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileIds: ["507f1f77bcf86cd799439068"]
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );
    const payload = (await response.json()) as {
      data: { selectedCount: number; candidateFiles: number; linkedCount: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data.selectedCount).toBe(1);
    expect(payload.data.candidateFiles).toBe(1);
    expect(payload.data.linkedCount).toBe(1);
    expect(xaiMocks.addFileToXaiCollection).toHaveBeenCalledTimes(1);
    expect(xaiMocks.addFileToXaiCollection).toHaveBeenCalledWith({
      collectionId: "collection_ops-global",
      fileId: "file_xyz"
    });
  });

  it("sanitizes per-file link errors to avoid upstream payload leakage", async () => {
    xaiMocks.addFileToXaiCollection.mockRejectedValueOnce(
      new Error('xAI add file to collection failed: {"internal_ref":"secret_ref","api_key":"xai_abc"}')
    );

    const response = await postLinkFiles(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    const payload = (await response.json()) as {
      data: { failed: Array<{ fileId: string; error: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.data.failed).toHaveLength(1);
    expect(payload.data.failed[0]?.error).toBe("Failed to link file to xAI collection");
    expect(payload.data.failed[0]?.error).not.toContain("internal_ref");
    expect(payload.data.failed[0]?.error).not.toContain("xai_");
  });

  it("blocks non-ready uploaded files from linking and labels readiness", async () => {
    repositoryMocks.listRagFiles.mockResolvedValueOnce([
      {
        _id: new ObjectId("507f1f77bcf86cd799439166"),
        xaiUploadStatus: "uploaded",
        xaiProcessingStatus: "pending",
        xaiFileId: "file_pending",
        scope: "global"
      }
    ]);

    const response = await postLinkFiles(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    const payload = (await response.json()) as {
      data: {
        candidateFiles: number;
        readyCandidates: number;
        blockedCount: number;
        blockedFiles: Array<{ readiness: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.data.candidateFiles).toBe(1);
    expect(payload.data.readyCandidates).toBe(0);
    expect(payload.data.blockedCount).toBe(1);
    expect(payload.data.blockedFiles[0]?.readiness).toBe("pending_embeddings");
    expect(xaiMocks.addFileToXaiCollection).not.toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "file_pending" })
    );
  });

  it("returns auth response when unauthorized", async () => {
    apiAuthMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await postCreateCollection(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    expect(response.status).toBe(401);
  });
});
