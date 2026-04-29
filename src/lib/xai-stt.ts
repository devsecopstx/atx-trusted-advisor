import { getEnv, XAI_BASE_URL_DEFAULT } from "@/lib/env";
import { toXaiSttLanguage } from "@/lib/xai-stt-lang";

export type XaiSttTranscriptResult = {
  text: string;
  duration?: number;
  language?: string;
};

function getSttUrl(): string {
  const env = getEnv();
  const base = (env.XAI_BASE_URL ?? XAI_BASE_URL_DEFAULT).replace(/\/?$/, "");
  return `${base}/stt`;
}

export { toXaiSttLanguage } from "@/lib/xai-stt-lang";

function guessFilenameExtension(file: File): string {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot >= 0 && dot < name.length - 1) {
    return name.slice(dot + 1);
  }
  const mime = file.type.toLowerCase();
  if (mime.includes("webm")) {
    return "webm";
  }
  if (mime.includes("mp4") || mime.includes("m4a")) {
    return "m4a";
  }
  if (mime.includes("ogg")) {
    return "ogg";
  }
  if (mime.includes("wav")) {
    return "wav";
  }
  return "webm";
}

/**
 * Transcribe audio via xAI `POST /v1/stt` (multipart). Caller must enforce auth/size limits.
 */
export async function transcribeAudioWithXaiStt(input: {
  file: File;
  language?: string;
}): Promise<XaiSttTranscriptResult> {
  const env = getEnv();
  const apiKey = env.XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("missing_xai_api_key");
  }
  const lang = toXaiSttLanguage(input.language ?? "en");
  const buf = await input.file.arrayBuffer();
  const blob = new Blob([buf], {
    type: input.file.type && input.file.type.length > 0 ? input.file.type : "application/octet-stream"
  });
  const filename = `recording.${guessFilenameExtension(input.file)}`;

  const formData = new FormData();
  formData.append("format", "true");
  formData.append("language", lang);
  formData.append("file", blob, filename);

  const response = await fetch(getSttUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData
  });

  const rawText = await response.text();
  let raw: Record<string, unknown>;
  try {
    raw = rawText.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`xai_stt_invalid_json:${response.status}`);
  }

  if (!response.ok) {
    const errMsg =
      typeof raw.error === "string"
        ? raw.error
        : typeof raw.message === "string"
          ? raw.message
          : `http_${response.status}`;
    throw new Error(`xai_stt:${errMsg}`);
  }

  const text = typeof raw.text === "string" ? raw.text : "";
  const duration = typeof raw.duration === "number" ? raw.duration : undefined;
  const language = typeof raw.language === "string" ? raw.language : undefined;

  return { text, duration, language };
}
