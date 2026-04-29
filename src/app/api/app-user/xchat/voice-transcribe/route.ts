import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { transcribeAudioWithXaiStt } from "@/lib/xai-stt";

const jsonBodySchema = z.object({
  transcriptDraft: z.string().trim().min(1).max(4000),
  locale: z.string().trim().max(32).optional()
});

const MAX_AUDIO_BYTES = 32 * 1024 * 1024;

/**
 * Voice composer: multipart `audio` → xAI `POST /v1/stt` (primary).
 * JSON `{ transcriptDraft }` → whitespace normalize (browser Web Speech API fallback path).
 */
export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
    }
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Missing or empty audio file" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio too large" }, { status: 413 });
    }
    const langRaw = form.get("language");
    const language =
      typeof langRaw === "string" && langRaw.trim().length > 0 ? langRaw.trim() : "en";

    try {
      const result = await transcribeAudioWithXaiStt({
        file: audio,
        language
      });
      const transcript = result.text.replace(/\s+/g, " ").trim();
      if (!transcript) {
        return NextResponse.json({ error: "Empty transcript", code: "xai_stt_empty" }, { status: 502 });
      }
      return NextResponse.json({
        data: {
          transcript,
          duration: result.duration,
          locale: language,
          source: "xai_stt"
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "stt_failed";
      console.warn("[xchat/voice-transcribe] xAI STT failed", msg);
      return NextResponse.json(
        { error: "Transcription unavailable", code: "xai_stt_failed" },
        { status: 503 }
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = jsonBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const transcript = parsed.data.transcriptDraft.replace(/\s+/g, " ").trim();
  return NextResponse.json({
    data: {
      transcript,
      locale: parsed.data.locale ?? "en-US",
      source: "browser_stt"
    }
  });
}
