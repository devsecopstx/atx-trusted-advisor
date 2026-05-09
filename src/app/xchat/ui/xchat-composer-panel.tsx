"use client";

import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type FocusEvent,
    type FormEvent,
    type KeyboardEvent,
    type MutableRefObject,
    type RefObject
} from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
    canUseNativeXaiStt,
    startNativeXaiSttSession,
    type NativeXaiSttSessionControls
} from "@/app/xchat/ui/xchat-native-stt-client";
import { VoiceModeSession } from "@/app/xchat/voice/VoiceModeSession";

import { XchatPersonaMenu } from "@/app/xchat/ui/xchat-persona-menu";
import { XchatReasoningModeToggle } from "@/app/xchat/ui/xchat-reasoning-mode-toggle";
import { XchatTemplatesStrip } from "@/app/xchat/ui/xchat-templates-strip";

import type { XchatReasoningMode } from "@/modules/xchat/xchat-reasoning-mode";

import { XchatComposerNav } from "./xchat-composer-nav";
import { hnwiComposerSuggestions } from "./xchat-example-prompts";
import { readClipboardImageFileForXchat } from "./xchat-paste-image-client";

const EXAMPLE_PLACEHOLDER_INTERVAL_MS = 10_000;

const ASK_PROGRESS_BADGES = [
  "Gathering portfolio & account snapshot…",
  "Fetching live Yahoo quotes & OI/IV…",
  "Consulting options-strategy RAG + X sentiment…",
  "Synthesizing conservative / balanced / aggressive outlooks…"
] as const;

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
  personaSelectRows: Array<{ _id: string; name: string; previewLine?: string }>;
  personaListError: string | null;
  personaPickerLocked: boolean;
  selectedPersonaId: string;
  setSelectedPersonaId: (id: string) => void;
  userPickedPersonaRef: MutableRefObject<boolean>;
  /** Open templates gallery + search on first paint (e.g. `?rail=xchat&item=examples`). */
  templatesGalleryInitiallyExpanded?: boolean;
  /** Premium+ / global_admin: show composer paperclip → tenant attachments API. */
  tenantFileUploadEnabled?: boolean;
  /** Deep link to workspace rail attachments / User Collections (preserve portfolio when set). */
  sourcesRailHref: string;
  /** Abort in-flight ask (same as thread Stop). */
  onCancelAsk?: () => void;
  /** Active persona display name — Voice Mode instructions + captions context. */
  voiceSessionPersonaLabel: string;
  reasoningMode: XchatReasoningMode;
  setReasoningMode: (mode: XchatReasoningMode) => void;
  /** -1 = hidden; 0–3 = phased status copy while ask is in flight */
  askProgressPhaseIndex: number;
  quoteFreshness: "cached_first" | "live";
  onQuoteFreshnessChange: (next: "cached_first" | "live") => void;
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
  templatesGalleryInitiallyExpanded = false,
  tenantFileUploadEnabled = false,
  sourcesRailHref,
  onCancelAsk,
  voiceSessionPersonaLabel,
  reasoningMode,
  setReasoningMode,
  askProgressPhaseIndex,
  quoteFreshness,
  onQuoteFreshnessChange
}: XchatComposerPanelProps) {
  const reduceMotion = useReducedMotion();
  const [composerFocused, setComposerFocused] = useState(false);
  /** Rotating example placeholders stop while the textarea itself is focused (user can type freely). */
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [examplePlaceholderIx, setExamplePlaceholderIx] = useState(0);
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationSupported, setDictationSupported] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const dictationSessionRef = useRef<NativeXaiSttSessionControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDictationSupported(canUseNativeXaiStt());
  }, []);

  useEffect(() => {
    return () => {
      dictationSessionRef.current?.abort();
    };
  }, []);

  const allowExamplePlaceholderCycle =
    !loading &&
    !dictationActive &&
    !pendingPasteImage &&
    !input.trim() &&
    !textareaFocused &&
    reduceMotion !== true;

  useEffect(() => {
    if (!allowExamplePlaceholderCycle) {
      return;
    }
    const id = window.setInterval(() => {
      setExamplePlaceholderIx((i) => (i + 1) % hnwiComposerSuggestions.length);
    }, EXAMPLE_PLACEHOLDER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [allowExamplePlaceholderCycle]);

  const composerPlaceholder =
    loading
      ? "Wait for reply…"
      : dictationActive
        ? "Listening… tap mic to stop"
        : pendingPasteImage
          ? "Optional caption for your screenshot…"
          : textareaFocused
            ? ""
            : !input.trim() && reduceMotion !== true
              ? hnwiComposerSuggestions[examplePlaceholderIx] ?? "Ask anything…"
              : "Ask anything…";

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

  async function toggleDictation() {
    if (dictationActive) {
      dictationSessionRef.current?.stop();
      dictationSessionRef.current = null;
      return;
    }
    setDictationError(null);

    if (!canUseNativeXaiStt()) {
      setDictationError("Dictation needs microphone access and MediaRecorder in this browser.");
      return;
    }

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
    if (!native) {
      setDictationError(
        dictationSupported
          ? "Could not open the microphone for recording."
          : "Dictation requires MediaRecorder and microphone access."
      );
      return;
    }
    dictationSessionRef.current = native;
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
      <XchatTemplatesStrip
        askInFlight={loading}
        composerDraft={input}
        composerRef={composerRef}
        initiallyExpanded={templatesGalleryInitiallyExpanded}
        setInput={setInput}
      />
      {loading && askProgressPhaseIndex >= 0 ? (
        <div aria-live="polite" className="xchat-composer-progress" role="status">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={askProgressPhaseIndex}
              animate={{ opacity: 1, y: 0 }}
              className="xchat-composer-progress__badge"
              exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              transition={{ duration: reduceMotion ? 0 : 0.24 }}
            >
              {ASK_PROGRESS_BADGES[Math.min(askProgressPhaseIndex, ASK_PROGRESS_BADGES.length - 1)]}
            </motion.span>
          </AnimatePresence>
        </div>
      ) : null}
      <motion.form
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: composerFocused
                  ? "inset 0 1px 0 color-mix(in srgb, var(--xf-text-100) 8%, transparent), 0 0 0 1px color-mix(in srgb, var(--xf-gain-green) 42%, transparent), 0 4px 22px color-mix(in srgb, var(--xf-gain-green) 12%, transparent)"
                  : "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 1px 2px rgba(0, 0, 0, 0.35)"
              }
        }
        className="xchat-composer xchat-composer--grok"
        onBlurCapture={(e: FocusEvent<HTMLFormElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setComposerFocused(false);
          }
        }}
        onFocusCapture={() => {
          setComposerFocused(true);
        }}
        onSubmit={handleSend}
        ref={composerFormRef}
        transition={{ type: "spring", stiffness: 520, damping: 38 }}
      >
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
          <div className="xchat-composer__grok-leading">
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
                    className="xchat-composer__grok-tool xchat-composer__grok-tool--attach xchat-composer__grok-tool--toolbar"
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
                  className="xchat-composer__grok-tool xchat-composer__grok-tool--attach xchat-composer__grok-tool--muted xchat-composer__grok-tool--toolbar"
                  disabled
                  type="button"
                >
                  <XchatComposerAttachIcon />
                </button>
              </XfHoverHint>
            )}
          </div>
          <div className="xchat-composer__grok-field xchat-composer__grok-field--grow">
            <div className="xchat-composer__input-shell">
              <XfHoverHint hint="Open User Collections and attachments in the workspace rail">
                <Link
                  aria-label="Sources — workspace collections and attachments"
                  className="xchat-composer__sources xchat-composer__sources--embed"
                  href={sourcesRailHref}
                  scroll={false}
                >
                  <XchatComposerSourcesGridIcon />
                  <span className="xchat-composer__sources-label">Sources</span>
                </Link>
              </XfHoverHint>
              <XfHoverHint
                className="xchat-composer__input-grow"
                hint="Enter to send · Shift+Enter newline · Paste image (screenshot) to analyze"
              >
                <textarea
                  ref={composerRef}
                  aria-busy={loading}
                  aria-label="xChat message composer"
                  className="xchat-composer__field xchat-composer__textarea xchat-composer__textarea--grok xchat-composer__textarea--singleline"
                  maxLength={4000}
                  onBlur={() => {
                    setTextareaFocused(false);
                  }}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => {
                    setTextareaFocused(true);
                  }}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key !== "Enter" || e.shiftKey || loading || dictationActive) {
                      return;
                    }
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }}
                  onPaste={onComposerPaste}
                  placeholder={composerPlaceholder}
                  readOnly={loading || dictationActive}
                  rows={1}
                  value={input}
                />
              </XfHoverHint>
            </div>
          </div>
          <div className="xchat-composer__grok-trailing">
            {!personaPickerLocked ? (
              <div className="xchat-composer__persona-actions xchat-composer__persona-actions--toolbar">
                <XfHoverHint hint="Published persona for this prompt — Auto uses tenant default">
                  <div className="xchat-composer__persona-menu-wrap">
                    <XchatPersonaMenu
                      disabled={personaSelectRows.length === 0 || Boolean(personaListError)}
                      errorMessage={personaListError}
                      rows={personaSelectRows}
                      selectedPersonaId={selectedPersonaId}
                      onSelectPersonaId={(id) => {
                        userPickedPersonaRef.current = true;
                        setSelectedPersonaId(id);
                      }}
                    />
                  </div>
                </XfHoverHint>
              </div>
            ) : null}
            <XfHoverHint hint="Voice chat — realtime Grok audio (xAI). Separate from dictation.">
              <button
                aria-expanded={voiceModeOpen}
                aria-label="Open voice chat"
                className={`xchat-composer__grok-tool xchat-composer__grok-tool--wave xchat-composer__grok-tool--toolbar${voiceModeOpen ? " xchat-composer__grok-tool--voice-open" : ""}`}
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
                    : "Dictate — xAI speech-to-text (microphone recording)"
                  : "Dictation needs microphone access and MediaRecorder"
              }
            >
              <button
                aria-label={dictationActive ? "Stop dictation" : "Start dictation"}
                aria-pressed={dictationActive}
                className={`xchat-composer__grok-tool xchat-composer__grok-tool--mic xchat-composer__grok-tool--toolbar${dictationActive ? " xchat-composer__grok-tool--recording" : ""}`}
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
                className="xchat-composer__send-circle xchat-composer__send-circle--toolbar xchat-composer__send-circle--stop"
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
                className="xchat-composer__send-circle xchat-composer__send-circle--toolbar xchat-composer__send-circle--primary"
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
      </motion.form>
      <div className="xchat-composer-shortcuts">
        <div className="xchat-composer-shortcuts__row xchat-composer-shortcuts__row--split">
          <div className="xchat-composer-shortcuts__split-nav">
            <XchatComposerNav />
          </div>
          <div className="xchat-composer-secondary-controls">
            <XchatReasoningModeToggle
              compact
              disabled={loading}
              value={reasoningMode}
              onChange={setReasoningMode}
            />
            <div
              aria-label="Market data freshness"
              className="xchat-composer-quote-row xchat-composer-quote-row--inline xchat-composer-quote-row--toolbar"
              role="group"
            >
              <span className="xchat-composer-quote-row__label xchat-composer-quote-row__label--compact">
                <span className="sr-only">Market data</span>
                <span aria-hidden>Mkt</span>
              </span>
              <div className="xchat-composer-quote-row__segments">
                <button
                  aria-pressed={quoteFreshness === "cached_first"}
                  className={`xchat-composer-quote-row__seg${quoteFreshness === "cached_first" ? " xchat-composer-quote-row__seg--active" : ""}`}
                  disabled={loading}
                  title="Prefer Redis / warmed snapshot during US session for portfolio-style prompts (faster)"
                  type="button"
                  onClick={() => {
                    onQuoteFreshnessChange("cached_first");
                  }}
                >
                  Cache
                </button>
                <button
                  aria-pressed={quoteFreshness === "live"}
                  className={`xchat-composer-quote-row__seg${quoteFreshness === "live" ? " xchat-composer-quote-row__seg--active" : ""}`}
                  disabled={loading}
                  title="Always allow live Yahoo on cache miss for workspace watchlist quotes"
                  type="button"
                  onClick={() => {
                    onQuoteFreshnessChange("live");
                  }}
                >
                  Live
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="xchat-composer-hint xchat-composer-hint--collapse-narrow" role="note">
        Enter send · Shift+Enter newline · Paste screenshot (Ctrl/Cmd+V) for vision · Waveform voice chat · Mic dictation (xAI STT)
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
