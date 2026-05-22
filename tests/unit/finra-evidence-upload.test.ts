import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bootstrapMocks = vi.hoisted(() => ({
  resolveOrCreateUserBootstrapCollection: vi.fn()
}));

const xaiMocks = vi.hoisted(() => ({
  uploadFileToXai: vi.fn(),
  addFileToXaiCollection: vi.fn()
}));

const ragMocks = vi.hoisted(() => ({
  createRagFile: vi.fn(),
  replaceRagChunks: vi.fn()
}));

vi.mock("@/modules/core-admin/access-request-bootstrap", () => bootstrapMocks);
vi.mock("@/lib/xai", () => xaiMocks);
vi.mock("@/modules/xchat/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/repository")>();
  return {
    ...actual,
    createRagFile: ragMocks.createRagFile,
    replaceRagChunks: ragMocks.replaceRagChunks
  };
});

import { uploadFinraCredentialEvidenceToUserXchatHistory } from "@/modules/compliance/finra-evidence-upload";

describe("uploadFinraCredentialEvidenceToUserXchatHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bootstrapMocks.resolveOrCreateUserBootstrapCollection.mockResolvedValue({
      collectionId: "col-user-history-1",
      collectionName: "user-history"
    });
    xaiMocks.uploadFileToXai.mockResolvedValue({
      fileId: "file-evidence-1",
      processingStatus: "complete"
    });
    xaiMocks.addFileToXaiCollection.mockResolvedValue(undefined);
    ragMocks.createRagFile.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439099"),
      filename: "series65.pdf"
    });
  });

  it("uploads credential file to user xChat history collection", async () => {
    const result = await uploadFinraCredentialEvidenceToUserXchatHistory({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "advisor@test.local",
      filename: "series65.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3])
    });
    expect(result).toMatchObject({
      evidenceFilename: "series65.pdf",
      evidenceXaiFileId: "file-evidence-1",
      evidenceCollectionId: "col-user-history-1",
      linkedToCollection: true
    });
    expect(xaiMocks.addFileToXaiCollection).toHaveBeenCalledWith({
      collectionId: "col-user-history-1",
      fileId: "file-evidence-1"
    });
  });

  it("returns error when user collection cannot be resolved", async () => {
    bootstrapMocks.resolveOrCreateUserBootstrapCollection.mockResolvedValueOnce(null);
    const result = await uploadFinraCredentialEvidenceToUserXchatHistory({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "advisor@test.local",
      filename: "series65.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([1])
    });
    expect(result).toEqual({ error: "user_xchat_history_collection_unavailable" });
  });
});
