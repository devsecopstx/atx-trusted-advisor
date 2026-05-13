import { createHash } from "node:crypto";

import sharp from "sharp";

import { readVisionMaxDimensionFromEnv } from "@/lib/env";

import type { XchatPasteImageMediaType } from "@/modules/xchat/xchat-image-attachment";
import { scanImageBufferWithClamAV } from "@/modules/xchat/xchat-vision-virus-scan";

export type ProcessedXchatVisionImage = {
  mediaType: XchatPasteImageMediaType;
  dataUrl: string;
  byteLength: number;
  /** Full SHA-256 of decoded inbound bytes (pre-resize). */
  originalSha256Hex: string;
  /** Full SHA-256 of outbound bytes sent to xAI (post-resize / re-encode). */
  processedSha256Hex: string;
  /** Short fingerprint for logs (derived from processed hash). */
  contentFingerprint: string;
  width: number;
  height: number;
};

export type ProcessVisionImageResult =
  | { ok: true; value: ProcessedXchatVisionImage }
  | { ok: false; code: string; error: string };

function sha256hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Resize (max edge), strip metadata via re-encode, optional ClamAV scan (when enabled in env).
 */
export async function processDecodedXchatVisionImage(input: {
  decoded: Buffer;
  declaredMediaType: XchatPasteImageMediaType;
  maxDimensionPx?: number;
}): Promise<ProcessVisionImageResult> {
  const maxDim = input.maxDimensionPx ?? readVisionMaxDimensionFromEnv();
  const originalSha256Hex = sha256hex(input.decoded);

  try {
    const pipeline = sharp(input.decoded, {
      failOn: "error",
      limitInputPixels: 268_435_456,
      sequentialRead: true
    }).rotate();

    const meta = await pipeline.metadata();
    const hasAlpha = meta.hasAlpha === true;
    const resized = pipeline.resize({
      width: maxDim,
      height: maxDim,
      fit: "inside",
      withoutEnlargement: true
    });

    let outBuf: Buffer;
    let outMedia: XchatPasteImageMediaType;
    if (hasAlpha) {
      outBuf = await resized.png({ compressionLevel: 9, effort: 7 }).toBuffer();
      outMedia = "image/png";
    } else {
      outBuf = await resized.jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
      outMedia = "image/jpeg";
    }

    const scan = await scanImageBufferWithClamAV(outBuf);
    if (!scan.ok) {
      if (scan.kind === "threat") {
        return {
          ok: false,
          code: "vision_threat_detected",
          error: "Attachment rejected by virus scan."
        };
      }
      return {
        ok: false,
        code: "vision_scan_unavailable",
        error: "Virus scanner is enabled but could not complete (check ClamAV install and logs)."
      };
    }

    const processedSha256Hex = sha256hex(outBuf);
    const b64 = outBuf.toString("base64");
    const metaOut = await sharp(outBuf).metadata();
    const width = typeof metaOut.width === "number" ? metaOut.width : 0;
    const height = typeof metaOut.height === "number" ? metaOut.height : 0;

    return {
      ok: true,
      value: {
        mediaType: outMedia,
        dataUrl: `data:${outMedia};base64,${b64}`,
        byteLength: outBuf.length,
        originalSha256Hex,
        processedSha256Hex,
        contentFingerprint: processedSha256Hex.slice(0, 24),
        width,
        height
      }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: "vision_process_failed",
      error: `Could not process image: ${msg}`
    };
  }
}
