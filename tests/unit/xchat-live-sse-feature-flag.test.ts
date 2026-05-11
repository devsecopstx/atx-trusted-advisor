import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveXchatClientLiveSseEnabled } from "@/lib/xchat-live-sse-policy";

describe("resolveXchatClientLiveSseEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults on when env unset", () => {
    expect(resolveXchatClientLiveSseEnabled()).toBe(true);
  });

  it("honors NEXT_PUBLIC_XCHAT_LIVE_SSE off values", () => {
    vi.stubEnv("NEXT_PUBLIC_XCHAT_LIVE_SSE", "off");
    expect(resolveXchatClientLiveSseEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_XCHAT_LIVE_SSE", "false");
    expect(resolveXchatClientLiveSseEnabled()).toBe(false);
  });
});
