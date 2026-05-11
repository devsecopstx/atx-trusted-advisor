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

const MIN_RECORDING_MS = 400;

function recordingFilenameForMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base.includes("mp4") || base.includes("m4a")) {
    return "recording.m4a";
  }
  if (base.includes("ogg")) {
    return "recording.ogg";
  }
  return "recording.webm";
}

function emptyCaptureMessage(input: {
  recordingMs: number;
  micMuted: boolean;
  micEnabled: boolean;
}): string {
  if (input.micMuted) {
    return "Microphone is muted in the browser or OS — unmute and try again.";
  }
  if (!input.micEnabled) {
    return "Microphone input is disabled — check System Settings → Privacy & Security → Microphone.";
  }
  if (input.recordingMs < MIN_RECORDING_MS) {
    return "No audio captured — hold the mic for at least one second while speaking.";
  }
  return "No audio captured — check the selected input device and try again.";
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
  const recordingStartedAt = Date.now();
  const audioTracks = stream.getAudioTracks();

  recorder.ondataavailable = (ev: BlobEvent) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  recorder.onstop = () => {
    const recordingMs = Date.now() - recordingStartedAt;
    const micMuted = audioTracks.some((track) => track.muted);
    const micEnabled = audioTracks.some((track) => track.enabled);
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
      handlers.onError(emptyCaptureMessage({ recordingMs, micMuted, micEnabled }));
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
        fd.set("audio", blob, recordingFilenameForMime(recordedType));
        fd.set("language", toXaiSttLanguage(locale));
        const res = await fetch("/api/app-user/xchat/voice-transcribe", {
          method: "POST",
          body: fd
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          data?: { transcript?: string };
        };
        if (!res.ok) {
          const code = typeof payload.code === "string" ? payload.code : "";
          const fallback = payload.error ?? `Transcription failed (${res.status}).`;
          handlers.onError(
            code === "xai_stt_empty"
              ? "No speech detected — speak closer to the mic and try again."
              : fallback
          );
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
        try {
          recorder.requestData();
        } catch {
          /* ignore */
        }
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
