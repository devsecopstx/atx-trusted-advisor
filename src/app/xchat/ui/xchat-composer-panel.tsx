"use client";

import {
    type ClipboardEvent,
    type FormEvent,
    type KeyboardEvent,
    type MutableRefObject,
    type RefObject,
    useEffect,
    useId,
    useRef,
    useState
} from "react";

import Link from "next/link";

import { XfHoverHint } from "@/app/ui/xf-hover-hint";

import {
    XchatComposerArrowUpIcon,
    XchatComposerAttachIcon,
    XchatComposerMicIcon,
    XchatComposerSourcesGridIcon,
    XchatComposerStopIcon,
    XchatComposerWaveformIcon
} from "@/app/xchat/ui/xchat-composer-icons";
import {
    getSpeechRecognitionConstructor,
    startXchatDictationSession,
    type XchatDictationSessionControls
} from "@/app/xchat/ui/xchat-dictation-client";
import {
    canUseNativeXaiStt,
    startNativeXaiSttSession
} from "@/app/xchat/ui/xchat-native-stt-client";
import { normalizeComposerVoiceDraft } from "@/app/xchat/voice/DictationInput";
import { VoiceModeSession } from "@/app/xchat/voice/VoiceModeSession";

import { XchatComposerNav } from "./xchat-composer-nav";
import { readClipboardImageFileForXchat } from "./xchat-paste-image-client";
import { compactPersonaOptionLabel } from "./xchat-persona-label";

export type XchatPendingPasteImage = {
  mediaType: "image/png" | "image/jpeg";
  dataBase64: string;
  previewUrl: string;
};

export type XchatComposerPanelProps = {
  handleSend: (e: FormEvent<HTMLFormElement>) => void;
  composerFormRef: RefObject<HTMLFormElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  pendingPasteImage: XchatPendingPasteImage | null;
  setPendingPasteImage: (next: XchatPendingPasteImage | null) => void;
  pasteImageError: string | null;
  setPasteImageError: (next: string | null) => void;
  personaSelectRows: Array<{ _id: string; name: string }>;
  personaListError: string | null;
  personaPickerLocked: boolean;
  selectedPersonaId: string;
  setSelectedPersonaId: (id: string) => void;
  userPickedPersonaRef: MutableRefObject<boolean>;
  /** Prompt chips shown when Examples is expanded (under the composer). */
  promptExamples: string[];
  /** Open Examples on first paint (e.g. `?rail=xchat&item=examples`). */
  examplesInitiallyExpanded?: boolean;
  /** Premium+ / global_admin: show composer paperclip → tenant attachments API. */
  tenantFileUploadEnabled?: boolean;
  /** Deep link to workspace rail attachments / User Collections (preserve portfolio when set). */
  sourcesRailHref: string;
  /** Abort in-flight ask (same as thread Stop). */
  onCancelAsk?: () => void;
  /** Active persona display name — Voice Mode instructions + captions context. */
  voiceSessionPersonaLabel: string;
};

export function XchatComposerPanel({
  handleSend,
  composerFormRef,
  composerRef,
  loading,
  input,
  setInput,
  pendingPasteImage,
  setPendingPasteImage,
  pasteImageError,
  setPasteImageError,
  personaSelectRows,
  personaListError,
  personaPickerLocked,
  selectedPersonaId,
  setSelectedPersonaId,
  userPickedPersonaRef,
  promptExamples,
  examplesInitiallyExpanded = false,
  tenantFileUploadEnabled = false,
  sourcesRailHref,
  onCancelAsk,
  voiceSessionPersonaLabel
}: XchatComposerPanelProps) {
  const examplesPanelId = useId();
  const examplesTriggerId = useId();
  const [examplesOpen, setExamplesOpen] = useState(examplesInitiallyExpanded);
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationSupported, setDictationSupported] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const dictationSessionRef = useRef<XchatDictationSessionControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDictationSupported(
      Boolean(canUseNativeXaiStt() || getSpeechRecognitionConstructor())
    );
  }, []);

  useEffect(() => {
    return () => {
      dictationSessionRef.current?.abort();
    };
  }, []);

  const canSend = Boolean(input.trim()) || Boolean(pendingPasteImage);

  async function onComposerPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (loading) {
      return;
    }
    const items = e.clipboardData?.items;
    if (!items?.length) {
      return;
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      e.preventDefault();
      const result = await readClipboardImageFileForXchat(file);
      if (!result.ok) {
        setPasteImageError(result.error);
        return;
      }
      setPasteImageError(null);
      setPendingPasteImage({
        mediaType: result.mediaType,
        dataBase64: result.dataBase64,
        previewUrl: result.previewUrl
      });
      return;
    }
  }

  async function normalizeVoiceDraft(raw: string) {
    const next = await normalizeComposerVoiceDraft(raw);
    if (next) {
      setInput(next);
    }
  }

  async function toggleDictation() {
    if (dictationActive) {
      dictationSessionRef.current?.stop();
      dictationSessionRef.current = null;
      return;
    }
    setDictationError(null);

    if (canUseNativeXaiStt()) {
      const native = await startNativeXaiSttSession(input, {
        onUpdate: setInput,
        onEnded: () => {
          setDictationActive(false);
          dictationSessionRef.current = null;
        },
        onError: (msg) => {
          setDictationError(msg);
          setDictationActive(false);
          dictationSessionRef.current = null;
        }
      });
      if (native) {
        dictationSessionRef.current = native;
        setDictationActive(true);
        return;
      }
    }

    const session = startXchatDictationSession(input, {
      onUpdate: setInput,
      onEnded: () => {
        setDictationActive(false);
        dictationSessionRef.current = null;
        const v = composerRef.current?.value ?? "";
        void normalizeVoiceDraft(v);
      },
      onError: (msg) => {
        setDictationError(msg);
        setDictationActive(false);
        dictationSessionRef.current = null;
      }
    });
    if (!session) {
      setDictationError(
        dictationSupported ? "Could not start dictation." : "Voice input needs microphone access or Web Speech API."
      );
      return;
    }
    dictationSessionRef.current = session;
    setDictationActive(true);
  }

  async function onAttachPicked(file: File | undefined) {
    if (!file || file.size === 0) {
      return;
    }
    setAttachNote(null);
    setAttachBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/app-user/xchat/attachments", { method: "POST", body: fd });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { file?: { filename?: string } };
      };
      if (!res.ok) {
        setAttachNote(payload.error ?? `Upload failed (${res.status}).`);
        return;
      }
      const name = payload.data?.file?.filename ?? file.name;
      setAttachNote(`Uploaded “${name}” to your tenant collection — indexing may take a moment.`);
    } catch {
      setAttachNote("Network error during upload.");
    } finally {
      setAttachBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="xchat-composer-wrap" id="xchat-composer">
      <form className="xchat-composer xchat-composer--grok" onSubmit={handleSend} ref={composerFormRef}>
        {pendingPasteImage ? (
          <div className="xchat-composer-paste-preview">
            <div className="xchat-composer-paste-preview__thumb">
              {/* Data-URL paste preview — not a remote URL; next/image is a poor fit. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" height={72} src={pendingPasteImage.previewUrl} width={72} />
            </div>
            <div className="xchat-composer-paste-preview__meta">
              Screenshot ready — add a caption (optional) and send. Vision uses xAI (see{" "}
              <a
                className="xchat-composer-paste-preview__link"
                href="https://docs.x.ai/developers/quickstart#step-5-analyze-an-image"
                rel="noreferrer"
                target="_blank"
              >
                image analysis
              </a>
              ).
            </div>
            <button
              className="xchat-composer-paste-preview__clear"
              disabled={loading}
              type="button"
              onClick={() => {
                setPendingPasteImage(null);
                setPasteImageError(null);
              }}
            >
              Remove
            </button>
          </div>
        ) : null}
        {pasteImageError ? <p className="xchat-composer-paste-err">{pasteImageError}</p> : null}
        <div className="xchat-composer__grok-bar">
          <div className="xchat-composer__grok-left">
            {tenantFileUploadEnabled ? (
              <>
                <input
                  ref={fileInputRef}
                  accept="*/*"
                  aria-hidden
                  className="sr-only"
                  tabIndex={-1}
                  type="file"
                  onChange={(e) => {
                    void onAttachPicked(e.target.files?.[0]);
                  }}
                />
                <XfHoverHint hint="Upload a file to your tenant knowledge collection (Premium+)">
                  <button
                    aria-busy={attachBusy}
                    aria-label="Upload file to tenant collection"
                    className="xchat-composer__grok-tool xchat-composer__grok-tool--attach"
                    disabled={loading || attachBusy || dictationActive}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <XchatComposerAttachIcon />
                  </button>
                </XfHoverHint>
              </>
            ) : (
              <XfHoverHint hint="Premium+ adds tenant file uploads from the paperclip">
                <button
                  aria-label="Attach — Premium+ tenant uploads"
                  className="xchat-composer__grok-tool xchat-composer__grok-tool--attach xchat-composer__grok-tool--muted"
                  disabled
                  type="button"
                >
                  <XchatComposerAttachIcon />
                </button>
              </XfHoverHint>
            )}
            <XfHoverHint hint="Open User Collections & attachments in the workspace rail">
              <Link
                className="xchat-composer__sources"
                href={sourcesRailHref}
                scroll={false}
              >
                <XchatComposerSourcesGridIcon />
                <span className="xchat-composer__sources-label">Sources</span>
              </Link>
            </XfHoverHint>
          </div>
          <div className="xchat-composer__grok-field">
            <XfHoverHint
              className="xchat-composer__input-grow"
              hint="Enter to send · Shift+Enter newline · Paste image (screenshot) to analyze"
            >
              <textarea
                ref={composerRef}
                aria-busy={loading}
                className="xchat-composer__field xchat-composer__textarea xchat-composer__textarea--grok"
                maxLength={4000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key !== "Enter" || e.shiftKey || loading || dictationActive) {
                    return;
                  }
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }}
                onPaste={onComposerPaste}
                placeholder={
                  loading
                    ? "Wait for reply…"
                    : dictationActive
                      ? "Listening… tap mic to stop"
                      : pendingPasteImage
                        ? "Optional caption for your screenshot…"
                        : "Ask anything…"
                }
                readOnly={loading || dictationActive}
                rows={1}
                value={input}
              />
            </XfHoverHint>
          </div>
          <div className="xchat-composer__grok-right">
            {!personaPickerLocked ? (
              <div className="xchat-composer__persona-actions xchat-composer__persona-actions--grok">
                <label className="sr-only" htmlFor="xchat-composer-persona-picker">
                  Persona for this message
                </label>
                <XfHoverHint hint="Published persona for this prompt (Default = Auto)">
                  <div className="xchat-composer__auto-pill-wrap">
                    <select
                      aria-label="Persona for this message"
                      className="xchat-composer__auto-pill"
                      disabled={personaSelectRows.length === 0 || Boolean(personaListError)}
                      id="xchat-composer-persona-picker"
                      onChange={(e) => {
                        userPickedPersonaRef.current = true;
                        setSelectedPersonaId(e.target.value);
                      }}
                      value={selectedPersonaId}
                    >
                      <option value="">Auto</option>
                      {personaSelectRows.map((p) => (
                        <option key={p._id} title={p.name} value={p._id}>
                          {compactPersonaOptionLabel(p.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                </XfHoverHint>
              </div>
            ) : null}
            <XfHoverHint hint="Voice chat — realtime Grok audio (xAI). Separate from dictation.">
              <button
                aria-expanded={voiceModeOpen}
                aria-label="Open voice chat"
                className={`xchat-composer__grok-tool xchat-composer__grok-tool--wave${voiceModeOpen ? " xchat-composer__grok-tool--voice-open" : ""}`}
                disabled={loading || attachBusy || dictationActive}
                type="button"
                onClick={() => {
                  setVoiceModeOpen(true);
                }}
              >
                <XchatComposerWaveformIcon />
              </button>
            </XfHoverHint>
            <XfHoverHint
              hint={
                dictationSupported
                  ? dictationActive
                    ? "Stop dictation"
                    : "Dictate — xAI transcription (browser speech if mic unavailable)"
                  : "Voice needs microphone access or a browser with speech recognition"
              }
            >
              <button
                aria-label={dictationActive ? "Stop dictation" : "Start dictation"}
                aria-pressed={dictationActive}
                className={`xchat-composer__grok-tool xchat-composer__grok-tool--mic${dictationActive ? " xchat-composer__grok-tool--recording" : ""}`}
                disabled={loading || attachBusy || !dictationSupported}
                type="button"
                onClick={() => {
                  toggleDictation();
                }}
              >
                <XchatComposerMicIcon />
              </button>
            </XfHoverHint>
            {loading && onCancelAsk ? (
              <button
                aria-label="Stop generating"
                className="xchat-composer__send-circle xchat-composer__send-circle--stop"
                type="button"
                onClick={() => {
                  onCancelAsk();
                }}
              >
                <XchatComposerStopIcon />
              </button>
            ) : (
              <button
                aria-label="Send message"
                className="xchat-composer__send-circle"
                disabled={loading || !canSend}
                type="submit"
              >
                <XchatComposerArrowUpIcon />
              </button>
            )}
          </div>
        </div>
        {dictationError ? (
          <p className="status-text status-error xchat-composer-inline-msg">{dictationError}</p>
        ) : null}
        {attachNote ? (
          <p className="status-text xchat-composer-attach-note xchat-composer-inline-msg">{attachNote}</p>
        ) : null}
      </form>
      <div className="xchat-composer-shortcuts">
        <div className="xchat-composer-shortcuts__row">
          <XchatComposerNav />
          {promptExamples.length > 0 ? (
            <XfHoverHint hint="Show example prompts you can paste into the composer">
              <button
                aria-controls={examplesPanelId}
                aria-expanded={examplesOpen}
                className="xchat-composer-examples__toggle"
                id={examplesTriggerId}
                type="button"
                onClick={() => {
                  setExamplesOpen((o) => !o);
                }}
              >
                <span>Examples</span>
                <svg
                  aria-hidden
                  className={`xchat-composer-examples__chevron${examplesOpen ? " xchat-composer-examples__chevron--open" : ""}`}
                  fill="none"
                  height={16}
                  viewBox="0 0 24 24"
                  width={16}
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
            </XfHoverHint>
          ) : null}
        </div>
        {promptExamples.length > 0 && examplesOpen ? (
          <div
            className="xchat-composer-examples__panel"
            id={examplesPanelId}
            role="region"
            aria-labelledby={examplesTriggerId}
          >
            <div className="xchat-composer-examples__list">
              {promptExamples.map((prompt, i) => (
                <XfHoverHint key={`composer-example-${i}`} hint={prompt}>
                  <button
                    className="app-user-rail-sublink xchat-rail-link xchat-composer-examples__chip"
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      queueMicrotask(() => {
                        const el = composerRef.current;
                        if (el) {
                          el.focus();
                          el.style.height = "auto";
                          el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
                        }
                      });
                    }}
                  >
                    <span className="xchat-rail-link__text">{prompt}</span>
                  </button>
                </XfHoverHint>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <p className="xchat-composer-hint" role="note">
        Enter send · Shift+Enter newline · Paste screenshot (Ctrl/Cmd+V) for vision · Waveform voice chat · Mic dictation (xAI STT +
        browser fallback)
        {tenantFileUploadEnabled ? " · Paperclip uploads to your tenant collection" : ""}
      </p>

      <VoiceModeSession
        disabled={loading}
        open={voiceModeOpen}
        personaLabel={voiceSessionPersonaLabel}
        onClose={() => {
          setVoiceModeOpen(false);
        }}
      />
    </div>
  );
}
