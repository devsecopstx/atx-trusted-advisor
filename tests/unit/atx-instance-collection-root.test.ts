import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveUserHistoryXaiCollectionDisplayName } from "@/lib/atx-instance-collection-root";

describe("resolveUserHistoryXaiCollectionDisplayName", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses legacy atx-chat-<userId>-history when ATX_INSTANCE_COLLECTION_ROOT is unset", () => {
    vi.stubEnv("ATX_INSTANCE_COLLECTION_ROOT", "");
    expect(resolveUserHistoryXaiCollectionDisplayName("507f1f77bcf86cd799439011")).toBe(
      "atx-chat-507f1f77bcf86cd799439011-history"
    );
  });

  it("uses {root}-chat-<userId> when root is set", () => {
    vi.stubEnv("ATX_INSTANCE_COLLECTION_ROOT", "atx-stage-atx-fintech-advisor");
    expect(resolveUserHistoryXaiCollectionDisplayName("507f1f77bcf86cd799439011")).toBe(
      "atx-stage-atx-fintech-advisor-chat-507f1f77bcf86cd799439011"
    );
  });
});
