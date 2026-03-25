import { afterEach, describe, expect, it, vi } from "vitest";

import {
    resolveNormalizedAtxInstanceCollectionRoot,
    resolveUserHistoryXaiCollectionDisplayName
} from "@/lib/atx-instance-collection-root";

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

  it("strips mistaken -rag suffix so chat matches tenant root, not KB display name", () => {
    vi.stubEnv("ATX_INSTANCE_COLLECTION_ROOT", "atx-stage-atx-fintech-advisor-rag");
    expect(resolveUserHistoryXaiCollectionDisplayName("507f1f77bcf86cd799439011")).toBe(
      "atx-stage-atx-fintech-advisor-chat-507f1f77bcf86cd799439011"
    );
  });

  it("ignores collection_* mistaken for root (falls back to legacy history name)", () => {
    vi.stubEnv("ATX_INSTANCE_COLLECTION_ROOT", "collection_dbe0a1cc-bea8-41f5-b477-6b0cf3965704");
    expect(resolveUserHistoryXaiCollectionDisplayName("507f1f77bcf86cd799439011")).toBe(
      "atx-chat-507f1f77bcf86cd799439011-history"
    );
  });
});

describe("resolveNormalizedAtxInstanceCollectionRoot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns undefined for collection id env", () => {
    vi.stubEnv("ATX_INSTANCE_COLLECTION_ROOT", "collection_abcd1234");
    expect(resolveNormalizedAtxInstanceCollectionRoot()).toBeUndefined();
  });

  it("strips -rag suffix", () => {
    vi.stubEnv("ATX_INSTANCE_COLLECTION_ROOT", "atx-dev-foo-rag");
    expect(resolveNormalizedAtxInstanceCollectionRoot()).toBe("atx-dev-foo");
  });
});
