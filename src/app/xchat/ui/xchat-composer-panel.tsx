"use client";

import type { ClipboardEvent, FormEvent, KeyboardEvent, MutableRefObject, RefObject } from "react";

import { SendIcon } from "@/app/admin/ui/crud-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

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
  userPickedPersonaRef
}: XchatComposerPanelProps) {
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

  return (
    <div className="xchat-composer-wrap" id="xchat-composer">
      <form className="xchat-composer" onSubmit={handleSend} ref={composerFormRef}>
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
        <div className="xchat-composer__row xchat-composer__row--input">
          <XfHoverHint
            className="xchat-composer__input-grow"
            hint="Enter to send · Shift+Enter newline · Paste image (screenshot) to analyze"
          >
            <textarea
              ref={composerRef}
              aria-busy={loading}
              className="xchat-composer__field xchat-composer__textarea"
              maxLength={4000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key !== "Enter" || e.shiftKey || loading) {
                  return;
                }
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }}
              onPaste={onComposerPaste}
              placeholder={
                loading
                  ? "Wait for reply…"
                  : pendingPasteImage
                    ? "Optional caption for your screenshot…"
                    : "What's on your mind?"
              }
              readOnly={loading}
              rows={1}
              value={input}
            />
          </XfHoverHint>
        </div>
        <div className="xchat-composer__row xchat-composer__row--actions">
          {!personaPickerLocked ? (
            <div className="xchat-composer__persona-actions">
              <label className="sr-only" htmlFor="xchat-composer-persona-picker">
                Persona for this message
              </label>
              <XfHoverHint hint="Published persona for this prompt only — same list as the Persona rail">
                <select
                  aria-label="Persona for this message"
                  className="xchat-composer__persona-select xchat-composer__persona-select--inline"
                  disabled={personaSelectRows.length === 0 || Boolean(personaListError)}
                  id="xchat-composer-persona-picker"
                  onChange={(e) => {
                    userPickedPersonaRef.current = true;
                    setSelectedPersonaId(e.target.value);
                  }}
                  value={selectedPersonaId}
                >
                  <option value="">Default</option>
                  {personaSelectRows.map((p) => (
                    <option key={p._id} title={p.name} value={p._id}>
                      {compactPersonaOptionLabel(p.name)}
                    </option>
                  ))}
                </select>
              </XfHoverHint>
            </div>
          ) : null}
          <button className="xchat-composer__send" disabled={loading || !canSend} type="submit">
            <SendIcon className="crud-icon" />
            Send
          </button>
        </div>
      </form>
      <XchatComposerNav />
      <p className="xchat-composer-hint" role="note">
        <span className="xchat-composer-hint__pill">Beta</span>
        <span className="xchat-composer-hint__text">
          Enter send · Shift+Enter newline · Paste screenshot (Ctrl/Cmd+V) to analyze with Grok vision
        </span>
      </p>
    </div>
  );
}
