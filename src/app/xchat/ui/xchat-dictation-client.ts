/**
 * Browser Web Speech API wrapper for xChat composer dictation (no live voice session).
 */

/** Minimal typing — `SpeechRecognition` types are not in all TS `lib.dom` builds. */
type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike> & { length: number };
};

type SpeechRecognitionErrorEventLike = {
  readonly error: string;
  readonly message?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function mergeDictationSegments(baseText: string, tailText: string): string {
  const a = baseText.trimEnd();
  const b = tailText.trim();
  if (!b) {
    return a;
  }
  if (!a) {
    return b;
  }
  return `${a} ${b}`;
}

export function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type XchatDictationSessionHandlers = {
  onUpdate: (displayText: string) => void;
  /** Called once when the session ends (including after `stop()`). */
  onEnded: () => void;
  onError: (message: string) => void;
};

export type XchatDictationSessionControls = {
  stop: () => void;
  abort: () => void;
};

/**
 * Starts continuous dictation; caller should invoke `stop()` when the user toggles the mic off.
 * Returns null when the Web Speech API is unavailable.
 */
export function startXchatDictationSession(
  baseText: string,
  handlers: XchatDictationSessionHandlers
): XchatDictationSessionControls | null {
  const Ctor = getSpeechRecognitionConstructor();
  if (!Ctor) {
    return null;
  }
  const rec = new Ctor();
  let accumulatedFinal = "";
  let finished = false;

  function finishOnce() {
    if (finished) {
      return;
    }
    finished = true;
    handlers.onEnded();
  }

  rec.continuous = true;
  rec.interimResults = true;
  rec.lang =
    typeof navigator !== "undefined" && navigator.language && navigator.language.length > 0
      ? navigator.language
      : "en-US";

  rec.onresult = (event: SpeechRecognitionEventLike) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const row = event.results[i];
      const piece = row[0]?.transcript ?? "";
      if (row.isFinal) {
        accumulatedFinal += piece;
      } else {
        interim += piece;
      }
    }
    const tail = (accumulatedFinal + interim).replace(/\s+/g, " ");
    handlers.onUpdate(mergeDictationSegments(baseText, tail));
  };

  rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
    if (event.error === "aborted") {
      return;
    }
    const msg =
      event.error === "not-allowed"
        ? "Microphone permission denied."
        : event.error === "no-speech"
          ? "No speech detected."
          : event.message || event.error || "Dictation error.";
    handlers.onError(msg);
    finishOnce();
  };

  rec.onend = () => {
    finishOnce();
  };

  try {
    rec.start();
  } catch {
    handlers.onError("Could not start dictation.");
    finishOnce();
    return null;
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
  };
}
