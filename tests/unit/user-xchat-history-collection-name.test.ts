import { afterEach, describe, expect, it, vi } from "vitest";

import {
    buildUserXchatHistoryCollectionName,
    legacyUserXchatBootstrapCollectionName
} from "@/modules/core-admin/access-request-bootstrap";

describe("user xChat history xAI collection names", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses atx-chat-<userId>-history for new collections when instance root unset", () => {
    vi.stubEnv("ATX_INSTANCE_COLLECTION_ROOT", "");
    expect(buildUserXchatHistoryCollectionName("507f1f77bcf86cd799439011")).toBe(
      "atx-chat-507f1f77bcf86cd799439011-history"
    );
    expect(buildUserXchatHistoryCollectionName("  AbC123  ")).toBe("atx-chat-abc123-history");
  });

  it("exposes legacy bootstrap name for reconciliation", () => {
    expect(legacyUserXchatBootstrapCollectionName("507f1f77bcf86cd799439011")).toBe(
      "atx-finance-user-507f1f77bcf86cd799439011-xchat"
    );
  });
});
