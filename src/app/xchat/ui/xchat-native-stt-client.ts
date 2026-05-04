import {
    mergeDictationSegments,
    type XchatDictationSessionControls,
    type XchatDictationSessionHandlers
} from "@/app/xchat/ui/xchat-dictation-client";

import { toXaiSttLanguage } from "@/lib/xai-stt-lang";

export function canUseNativeXaiStt(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(typeof MediaRecorder !== "undefined" && navigator.mediaDevices?.getUserMedia);
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return undefined;
}

export type NativeXaiSttSessionControls = XchatDictationSessionControls;

/**
 * Records microphone audio and transcribes via `POST /api/app-user/xchat/voice-transcribe` (xAI STT only).
 * Returns null if the microphone or MediaRecorder cannot start.
 */
export async function startNativeXaiSttSession(
  baseText: string,
  handlers: XchatDictationSessionHandlers
): Promise<NativeXaiSttSessionControls | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }

  const mimeType = pickRecorderMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    stream.getTracks().forEach((t) => {
      t.stop();
    });
    return null;
  }

  const chunks: BlobPart[] = [];
  let aborted = false;

  recorder.ondataavailable = (ev: BlobEvent) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  recorder.onstop = () => {
    stream.getTracks().forEach((t) => {
      t.stop();
    });
    if (aborted) {
      handlers.onEnded();
      return;
    }

    const recordedType =
      recorder.mimeType && recorder.mimeType.length > 0 ? recorder.mimeType : mimeType ?? "audio/webm";
    const blob = new Blob(chunks, { type: recordedType.split(";")[0] });
    if (blob.size === 0) {
      handlers.onError("No audio captured.");
      handlers.onEnded();
      return;
    }

    const locale =
      typeof navigator !== "undefined" && navigator.language?.length
        ? navigator.language
        : "en-US";

    void (async () => {
      try {
        const fd = new FormData();
        fd.set("audio", blob, "recording.webm");
        fd.set("language", toXaiSttLanguage(locale));
        const res = await fetch("/api/app-user/xchat/voice-transcribe", {
          method: "POST",
          body: fd
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          data?: { transcript?: string };
        };
        if (!res.ok) {
          handlers.onError(payload.error ?? `Transcription failed (${res.status}).`);
          handlers.onEnded();
          return;
        }
        const text = payload.data?.transcript?.trim();
        if (text) {
          handlers.onUpdate(mergeDictationSegments(baseText, text));
        }
      } catch {
        handlers.onError("Network error during transcription.");
      }
      handlers.onEnded();
    })();
  };

  try {
    recorder.start(250);
  } catch {
    stream.getTracks().forEach((t) => {
      t.stop();
    });
    handlers.onError("Could not start recording.");
    handlers.onEnded();
    return null;
  }

  return {
    stop: () => {
      if (recorder.state === "recording") {
        recorder.stop();
      } else {
        stream.getTracks().forEach((t) => {
          t.stop();
        });
      }
    },
    abort: () => {
      aborted = true;
      try {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      } catch {
        /* ignore */
      }
      stream.getTracks().forEach((t) => {
        t.stop();
      });
    }
  };
}
