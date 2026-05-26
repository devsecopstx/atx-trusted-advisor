"use client";

import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type ClipboardEvent,
    type Dispatch,
    type FocusEvent,
    type FormEvent,
    type KeyboardEvent,
    type MutableRefObject,
    type RefObject,
    type SetStateAction
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

import { useVisualViewportKeyboardInset } from "@/lib/use-visual-viewport-keyboard-inset";
import { MAX_XCHAT_VISION_ATTACHMENTS_PER_ASK } from "@/modules/xchat/xchat-image-attachment";
import type { XchatReasoningMode } from "@/modules/xchat/xchat-reasoning-mode";

import { XCHAT_ASK_PROGRESS_BADGES } from "./xchat-ask-progress-badges";
import { hnwiComposerSuggestions } from "./xchat-example-prompts";
import { readClipboardImageFileForXchat } from "./xchat-paste-image-client";

const EXAMPLE_PLACEHOLDER_INTERVAL_MS = 10_000;

/** Rotating income/options hints under the composer (subset of rail examples). */
const COMPOSER_CONTEXT_HINTS = [
  "Covered calls & wheel income on your book",
  "Greeks, rolls, and expiration risk",
  "Open xOptions from a strategy answer"
] as const;

export type XchatPendingPasteImage = {
  mediaType: "image/png" | "image/jpeg";
  dataBase64: string;
  previewUrl: string;
};

export type XchatPastedTextBlock = {
  text: string;
  lineCount: number;
  charCount: number;
};

export type XchatComposerPanelProps = {
  handleSend: (e: FormEvent<HTMLFormElement>) => void;
  composerFormRef: RefObject<HTMLFormElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  pendingPasteImages: XchatPendingPasteImage[];
  setPendingPasteImages: Dispatch<SetStateAction<XchatPendingPasteImage[]>>;
  pasteImageError: string | null;
  setPasteImageError: (next: string | null) => void;
  /** Optional compacted multi-line paste (marker lives in `input`; full text is sent). */
  pastedTextBlock: XchatPastedTextBlock | null;
  setPastedTextBlock: Dispatch<SetStateAction<XchatPastedTextBlock | null>>;
  visionUseWorkspace: boolean;
  setVisionUseWorkspace: (next: boolean) => void;
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
  /** Short-lived notice (e.g. persona auto-switch for Heavy depth). */
  depthModeToast?: string | null;
  /** -1 = hidden; 0–3 = phased status copy while ask is in flight */
  askProgressPhaseIndex: number;
  quoteFreshness: "cached_first" | "live";
  onQuoteFreshnessChange: (next: "cached_first" | "live") => void;
  /** Scoped workspace portfolio for HNWI v2.1 template resolution. */
  workspacePortfolioId?: string | null;
  hnwiV21SlugForNextAskRef: MutableRefObject<string | null>;
};

export function XchatComposerPanel({
  handleSend,
  composerFormRef,
  composerRef,
  loading,
  input,
  setInput,
  pendingPasteImages,
  setPendingPasteImages,
  pasteImageError,
  setPasteImageError,
  pastedTextBlock,
  setPastedTextBlock,
  visionUseWorkspace,
  setVisionUseWorkspace,
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
  depthModeToast = null,
  askProgressPhaseIndex,
  quoteFreshness,
  onQuoteFreshnessChange,
  workspacePortfolioId = null,
  hnwiV21SlugForNextAskRef
}: XchatComposerPanelProps) {
  const keyboardInsetPx = useVisualViewportKeyboardInset();
  const reduceMotion = useReducedMotion();
  const [composerFocused, setComposerFocused] = useState(false);
  /** Rotating example placeholders stop while the textarea itself is focused (user can type freely). */
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [examplePlaceholderIx, setExamplePlaceholderIx] = useState(0);
  const [contextHintIx, setContextHintIx] = useState(0);
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
    !pendingPasteImages.length &&
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

  useEffect(() => {
    if (loading || dictationActive || reduceMotion === true) {
      return;
    }
    const id = window.setInterval(() => {
      setContextHintIx((i) => (i + 1) % COMPOSER_CONTEXT_HINTS.length);
    }, EXAMPLE_PLACEHOLDER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [loading, dictationActive, reduceMotion]);

  const composerPlaceholder =
    loading
      ? "Advisor working…"
      : dictationActive
        ? "Listening… tap mic to stop"
        : pendingPasteImages.length > 0
          ? "Optional caption for your screenshot…"
          : textareaFocused
            ? ""
            : !input.trim() && reduceMotion !== true
              ? hnwiComposerSuggestions[examplePlaceholderIx] ?? "Ask anything…"
              : "Ask anything…";

  const canSend = Boolean(input.trim()) || pendingPasteImages.length > 0;

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
      if (pendingPasteImages.length >= MAX_XCHAT_VISION_ATTACHMENTS_PER_ASK) {
        setPasteImageError(`You can attach up to ${MAX_XCHAT_VISION_ATTACHMENTS_PER_ASK} images per message.`);
        return;
      }
      e.preventDefault();
      const result = await readClipboardImageFileForXchat(file);
      if (!result.ok) {
        setPasteImageError(result.error);
        return;
      }
      setPasteImageError(null);
      setPendingPasteImages((prev) => {
        if (prev.length >= MAX_XCHAT_VISION_ATTACHMENTS_PER_ASK) {
          return prev;
        }
        return [
          ...prev,
          {
            mediaType: result.mediaType,
            dataBase64: result.dataBase64,
            previewUrl: result.previewUrl
          }
        ].slice(0, MAX_XCHAT_VISION_ATTACHMENTS_PER_ASK);
      });
      return;
    }

    // --- Text paste compaction for long / multi-line pastes (keeps composer UI compact like terminal Grok) ---
    // Only trigger for substantial pastes (multiple lines or long single block). Small pastes use normal browser insertion.
    const pastedText = e.clipboardData?.getData("text/plain");
    if (pastedText && pastedText.trim().length > 0) {
      const normalized = pastedText.replace(/\r\n?/g, "\n");
      const lineCount = normalized.split("\n").length;
      const charCount = normalized.length;
      const isSubstantial = lineCount >= 4 || charCount > 220;

      if (isSubstantial) {
        e.preventDefault();
        // Clear any prior paste block and set new one + marker in the controlled input
        const marker = `[Pasted ${lineCount} lines · ${charCount.toLocaleString()} chars]`;
        setPastedTextBlock({ text: normalized, lineCount, charCount });
        setInput(marker);
        setPasteImageError(null);
        return;
      }
      // Small text paste: fall through and let the browser populate the textarea normally
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
    <div
      className="xchat-composer-wrap"
      id="xchat-composer"
      style={
        {
          ["--xchat-keyboard-inset" as string]: `${keyboardInsetPx}px`
        } as CSSProperties
      }
    >
      <XchatTemplatesStrip
        askInFlight={loading}
        composerDraft={input}
        composerRef={composerRef}
        hnwiV21SlugForNextAskRef={hnwiV21SlugForNextAskRef}
        initiallyExpanded={templatesGalleryInitiallyExpanded}
        setInput={setInput}
        workspacePortfolioId={workspacePortfolioId}
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
              {XCHAT_ASK_PROGRESS_BADGES[Math.min(askProgressPhaseIndex, XCHAT_ASK_PROGRESS_BADGES.length - 1)]}
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
        {pendingPasteImages.length > 0 ? (
          <div className="xchat-composer-paste-preview">
            <div className="xchat-composer-paste-preview__grid">
              {pendingPasteImages.map((img, idx) => (
                <div key={`${img.previewUrl.slice(0, 48)}-${idx}`} className="xchat-composer-paste-preview__cell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="xchat-composer-paste-preview__cell-img" height={72} src={img.previewUrl} width={72} />
                  <button
                    className="xchat-composer-paste-preview__cell-remove"
                    disabled={loading}
                    type="button"
                    onClick={() => {
                      setPendingPasteImages((prev) => prev.filter((_, j) => j !== idx));
                      if (pendingPasteImages.length <= 1) {
                        setPasteImageError(null);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="xchat-composer-paste-preview__meta">
              {pendingPasteImages.length} screenshot{pendingPasteImages.length > 1 ? "s" : ""} ready — add a caption (optional) and send. Vision uses xAI (see{" "}
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
            {workspacePortfolioId ? (
              <label className="xchat-composer-paste-preview__portfolio flex cursor-pointer items-center gap-2 text-sm text-[color:var(--xf-text-200)]">
                <input
                  checked={visionUseWorkspace}
                  className="accent-[color:var(--xf-tenant-accent,var(--xf-gain-green))]"
                  disabled={loading}
                  type="checkbox"
                  onChange={(ev) => {
                    setVisionUseWorkspace(ev.target.checked);
                  }}
                />
                Use with my portfolio (preload holdings + watchlist for tools)
              </label>
            ) : null}
            <button
              className="xchat-composer-paste-preview__clear"
              disabled={loading}
              type="button"
              onClick={() => {
                setPendingPasteImages([]);
                setPasteImageError(null);
                setVisionUseWorkspace(false);
              }}
            >
              Clear all
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
              {pastedTextBlock ? (
                <div className="xchat-composer__paste-chip" title="Full content will be sent to the model. Click edit to bring it into the box.">
                  <span className="xchat-composer__paste-chip__label">Pasted</span>
                  <button
                    type="button"
                    className="xchat-composer__paste-chip__btn"
                    onClick={() => {
                      if (pastedTextBlock) {
                        setInput(pastedTextBlock.text);
                        setPastedTextBlock(null);
                      }
                      // focus after swap
                      queueMicrotask(() => composerRef.current?.focus());
                    }}
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    className="xchat-composer__paste-chip__btn xchat-composer__paste-chip__btn--danger"
                    onClick={() => {
                      setPastedTextBlock(null);
                      setInput("");
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <XfHoverHint
                className="xchat-composer__input-grow"
                hint="Enter: send · Shift+Enter: newline · Paste: vision"
              >
                <textarea
                  ref={composerRef}
                  aria-busy={loading}
                  aria-label="xChat message composer"
                  className="xchat-composer__field xchat-composer__textarea xchat-composer__textarea--grok xchat-composer__textarea--singleline xchat-composer__textarea--hnwi"
                  maxLength={4000}
                  onBlur={() => {
                    setTextareaFocused(false);
                  }}
                  onChange={(e) => {
                    const next = e.target.value;
                    // If a paste block is active and the user has edited the marker away, drop the block
                    // so the typed text becomes the real prompt (normal flow).
                    if (pastedTextBlock && !next.startsWith("[Pasted ")) {
                      setPastedTextBlock(null);
                    }
                    setInput(next);
                  }}
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
                aria-busy={loading}
                aria-label="Send message"
                className="xchat-composer__send-pill xchat-composer__send-pill--toolbar xchat-composer__send-pill--primary"
                disabled={loading || !canSend}
                type="submit"
              >
                <span className="xchat-composer__send-pill-label">Send</span>
                <XchatComposerArrowUpIcon />
              </button>
            )}
          </div>
        </div>
        <div
          aria-label="Depth and market data"
          className="xchat-composer__toolbar-meta"
          role="region"
        >
          {depthModeToast ? (
            <p className="status-text xchat-depth-mode-toast" role="status">
              {depthModeToast}
            </p>
          ) : null}
          <XchatReasoningModeToggle
            compact
            disabled={loading}
            value={reasoningMode}
            onChange={setReasoningMode}
          />
          <div
            aria-label="Market data freshness"
            className="xchat-composer-quote-row xchat-composer-quote-row--inline xchat-composer-quote-row--toolbar xchat-composer-quote-row--in-toolbar-meta"
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
        {dictationError ? (
          <p className="status-text status-error xchat-composer-inline-msg">{dictationError}</p>
        ) : null}
        {attachNote ? (
          <p className="status-text xchat-composer-attach-note xchat-composer-inline-msg">{attachNote}</p>
        ) : null}
        <p className="xchat-composer-context-hint" role="note">
          {COMPOSER_CONTEXT_HINTS[contextHintIx]}
        </p>
      </motion.form>

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
