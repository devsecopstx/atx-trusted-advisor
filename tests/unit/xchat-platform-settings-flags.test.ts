import { describe, expect, it } from "vitest";

import {
    isXchatRemoteHistoryEnabled,
    isXchatUserHistoryXaiCollectionEnabled
} from "@/modules/xchat/xchat-platform-settings";

describe("xchat platform feature flags (Mongo-first history)", () => {
  it("keeps per-user xAI history upload off — Mongo xchat_logs is source of truth", () => {
    expect(isXchatUserHistoryXaiCollectionEnabled()).toBe(false);
  });

  it("keeps remote xAI conversation state off when XCHAT_USE_REMOTE_HISTORY is unset", () => {
    expect(isXchatRemoteHistoryEnabled()).toBe(false);
  });
});
