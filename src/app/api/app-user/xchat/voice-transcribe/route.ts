import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { transcribeAudioWithXaiStt } from "@/lib/xai-stt";

const MAX_AUDIO_BYTES = 32 * 1024 * 1024;

/**
 * Composer dictation: multipart `audio` → xAI `POST /v1/stt` only (no browser STT proxy).
 */
export async function POST(request: Request) {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error: "Multipart audio required — use MediaRecorder + FormData field audio",
        code: "voice_transcribe_multipart_only"
      },
      { status: 415 }
    );
  }

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
