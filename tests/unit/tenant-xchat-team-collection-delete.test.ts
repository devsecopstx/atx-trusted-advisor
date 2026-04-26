import { beforeEach, describe, expect, it, vi } from "vitest";

const xaiMocks = vi.hoisted(() => ({
  deleteXaiCollection: vi.fn(),
  hasXaiManagementApiKey: vi.fn()
}));

vi.mock("@/lib/xai", () => xaiMocks);

import { deleteTenantTeamXchatAttachmentsCollection } from "@/modules/platform/tenant-xchat-team-collection";

describe("deleteTenantTeamXchatAttachmentsCollection", () => {
  beforeEach(() => {
    xaiMocks.hasXaiManagementApiKey.mockReturnValue(true);
    xaiMocks.deleteXaiCollection.mockResolvedValue(undefined);
  });

  it("returns no_collection_id when preference unset", async () => {
    await expect(deleteTenantTeamXchatAttachmentsCollection({ tenantPreferences: {} })).resolves.toEqual({
      status: "no_collection_id"
    });
    expect(xaiMocks.deleteXaiCollection).not.toHaveBeenCalled();
  });

  it("skips when management key missing", async () => {
    xaiMocks.hasXaiManagementApiKey.mockReturnValue(false);
    await expect(
      deleteTenantTeamXchatAttachmentsCollection({
        tenantPreferences: { xchat_team_attachments_collection_id: "col_abc" }
      })
    ).resolves.toEqual({ status: "skipped_no_management_key", collectionId: "col_abc" });
    expect(xaiMocks.deleteXaiCollection).not.toHaveBeenCalled();
  });

  it("returns deleted on success", async () => {
    await expect(
      deleteTenantTeamXchatAttachmentsCollection({
        tenantPreferences: { xchat_team_attachments_collection_id: "col_ok" }
      })
    ).resolves.toEqual({ status: "deleted", collectionId: "col_ok" });
    expect(xaiMocks.deleteXaiCollection).toHaveBeenCalledWith("col_ok");
  });

  it("treats 404-style errors as already_absent", async () => {
    xaiMocks.deleteXaiCollection.mockRejectedValueOnce(new Error('xAI collection delete failed: {"code":404}'));
    await expect(
      deleteTenantTeamXchatAttachmentsCollection({
        tenantPreferences: { xchat_team_attachments_collection_id: "col_gone" }
      })
    ).resolves.toEqual({ status: "already_absent", collectionId: "col_gone" });
  });

  it("treats xAI code 5 missing-collection errors as already_absent", async () => {
    xaiMocks.deleteXaiCollection.mockRejectedValueOnce(
      new Error(
        `xAI collection delete failed: {"code":5,"message":"The collection 'collection_abc' doesn't exist or your team doesn't have access to it.","details":[]}`
      )
    );
    await expect(
      deleteTenantTeamXchatAttachmentsCollection({
        tenantPreferences: { xchat_team_attachments_collection_id: "col_gone_5" }
      })
    ).resolves.toEqual({ status: "already_absent", collectionId: "col_gone_5" });
  });

  it("returns failed on other API errors", async () => {
    xaiMocks.deleteXaiCollection.mockRejectedValueOnce(new Error("rate limited"));
    await expect(
      deleteTenantTeamXchatAttachmentsCollection({
        tenantPreferences: { xchat_team_attachments_collection_id: "col_bad" }
      })
    ).resolves.toEqual({
      status: "failed",
      collectionId: "col_bad",
      message: "rate limited"
    });
  });
});
