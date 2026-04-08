/** Client-only helpers for xChat clipboard images (keeps Node-only validation in `xchat-image-attachment.ts`). */

const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type XchatClientPasteImageOk = {
  ok: true;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  dataBase64: string;
  previewUrl: string;
};

export type XchatClientPasteImageResult = XchatClientPasteImageOk | { ok: false; error: string };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read_failed"));
    fr.readAsDataURL(file);
  });
}

export async function readClipboardImageFileForXchat(file: File): Promise<XchatClientPasteImageResult> {
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be 4MB or smaller." };
  }
  let mediaType = file.type.toLowerCase();
  if (mediaType === "image/jpg") {
    mediaType = "image/jpeg";
  }
  if (!ALLOWED.has(mediaType)) {
    return { ok: false, error: "Paste a PNG, JPEG, WebP, or GIF screenshot." };
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const comma = dataUrl.indexOf(",");
    if (comma < 0) {
      return { ok: false, error: "Could not read pasted image." };
    }
    return {
      ok: true,
      mediaType: mediaType as XchatClientPasteImageOk["mediaType"],
      dataBase64: dataUrl.slice(comma + 1),
      previewUrl: dataUrl
    };
  } catch {
    return { ok: false, error: "Could not read pasted image." };
  }
}
