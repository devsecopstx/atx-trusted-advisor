import { describe, expect, it } from "vitest";

import {
    MAX_XCHAT_PASTE_IMAGE_BYTES,
    parseAndValidateXchatPasteImage
} from "@/modules/xchat/xchat-image-attachment";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseAndValidateXchatPasteImage", () => {
  it("accepts a minimal PNG payload", () => {
    const r = parseAndValidateXchatPasteImage({
      mediaType: "image/png",
      dataBase64: TINY_PNG_BASE64
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(r.value.byteLength).toBeGreaterThan(30);
      expect(r.value.contentFingerprint.length).toBe(24);
    }
  });

  it("rejects wrong media type", () => {
    const r = parseAndValidateXchatPasteImage({
      mediaType: "image/svg+xml",
      dataBase64: TINY_PNG_BASE64
    });
    expect(r.ok).toBe(false);
  });

  it("rejects oversize decoded payload", () => {
    const huge = Buffer.alloc(MAX_XCHAT_PASTE_IMAGE_BYTES + 1, 0xff).toString("base64");
    const r = parseAndValidateXchatPasteImage({
      mediaType: "image/png",
      dataBase64: huge
    });
    expect(r.ok).toBe(false);
  });
});
