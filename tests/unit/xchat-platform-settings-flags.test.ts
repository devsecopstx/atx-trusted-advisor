import { describe, expect, it } from "vitest";

import { isXchatRemoteHistoryEnabled } from "@/modules/xchat/xchat-platform-settings";

describe("xchat platform feature flags (Mongo-first history)", () => {
  it("keeps remote xAI conversation state off when XCHAT_USE_REMOTE_HISTORY is unset", () => {
    expect(isXchatRemoteHistoryEnabled()).toBe(false);
  });
});
