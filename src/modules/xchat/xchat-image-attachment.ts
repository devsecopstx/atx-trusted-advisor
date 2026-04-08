import { createHash } from "node:crypto";

/**
 * Allowed clipboard / paste MIME types for xChat vision turns.
 * xAI image understanding currently documents **PNG / JPEG** only (WebP/GIF tend to 4xx from `/v1/responses`).
 */
export const XCHAT_PASTE_IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg"] as const;

export type XchatPasteImageMediaType = (typeof XCHAT_PASTE_IMAGE_MEDIA_TYPES)[number];

/** Decoded image bytes cap (per [xAI vision quickstart](https://docs.x.ai/developers/quickstart#step-5-analyze-an-image) style flows). */
export const MAX_XCHAT_PASTE_IMAGE_BYTES = 4 * 1024 * 1024;

/** Max JSON body size for `/api/xchat/ask` when an image is included (base64 expands payload). */
export const MAX_XCHAT_ASK_JSON_BYTES = 8 * 1024 * 1024;

export type ParsedXchatPasteImage = {
  mediaType: XchatPasteImageMediaType;
  /** Full data URL for xAI `input_image.image_url`. */
  dataUrl: string;
  byteLength: number;
  /** Short stable fingerprint for request correlation (not reversible to pixels). */
  contentFingerprint: string;
};

export type XchatImageAttachmentPayload = {
  mediaType: string;
  dataBase64: string;
};

export function parseAndValidateXchatPasteImage(
  raw: XchatImageAttachmentPayload
): { ok: true; value: ParsedXchatPasteImage } | { ok: false; error: string } {
  const mediaType = raw.mediaType.trim().toLowerCase();
  if (!XCHAT_PASTE_IMAGE_MEDIA_TYPES.includes(mediaType as XchatPasteImageMediaType)) {
    return { ok: false, error: "Unsupported image mediaType" };
  }
  const b64 = raw.dataBase64.replace(/\s/g, "");
  if (b64.length < 16) {
    return { ok: false, error: "Image data missing or too small" };
  }
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 32) {
    return { ok: false, error: "Decoded image too small" };
  }
  if (buf.length > MAX_XCHAT_PASTE_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image exceeds maximum decoded size (${MAX_XCHAT_PASTE_IMAGE_BYTES} bytes)`
    };
  }
  const typed = mediaType as XchatPasteImageMediaType;
  const dataUrl = `data:${typed};base64,${b64}`;
  const contentFingerprint = createHash("sha256").update(buf).digest("hex").slice(0, 24);
  return {
    ok: true,
    value: {
      mediaType: typed,
      dataUrl,
      byteLength: buf.length,
      contentFingerprint
    }
  };
}
