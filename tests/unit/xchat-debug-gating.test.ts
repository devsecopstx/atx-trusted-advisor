import { describe, expect, it } from "vitest";

import { isXchatStructuredDebugEnabled } from "@/lib/xchat-debug";
import { runWithXchatTenantDebug, runWithXchatTenantDebugAsync } from "@/lib/xchat-debug-context";

describe("xchat structured debug gating", () => {
  it("is false outside tenant debug ALS", () => {
    expect(isXchatStructuredDebugEnabled()).toBe(false);
  });

  it("is false inside ALS when tenant flag is false", () => {
    runWithXchatTenantDebug(false, () => {
      expect(isXchatStructuredDebugEnabled()).toBe(false);
    });
  });

  it("is true inside ALS when tenant flag is true", () => {
    runWithXchatTenantDebug(true, () => {
      expect(isXchatStructuredDebugEnabled()).toBe(true);
    });
  });

  it("async ALS wrapper matches sync semantics", async () => {
    await runWithXchatTenantDebugAsync(true, async () => {
      expect(isXchatStructuredDebugEnabled()).toBe(true);
    });
    expect(isXchatStructuredDebugEnabled()).toBe(false);
  });

  it("does not enable from process.env ENABLE_XCHAT_DEBUG without ALS (legacy env ignored)", () => {
    const prev = process.env.ENABLE_XCHAT_DEBUG;
    process.env.ENABLE_XCHAT_DEBUG = "true";
    try {
      expect(isXchatStructuredDebugEnabled()).toBe(false);
      runWithXchatTenantDebug(false, () => {
        expect(isXchatStructuredDebugEnabled()).toBe(false);
      });
    } finally {
      if (prev === undefined) {
        delete process.env.ENABLE_XCHAT_DEBUG;
      } else {
        process.env.ENABLE_XCHAT_DEBUG = prev;
      }
    }
  });
});
