"use client";

import type { FormEvent, KeyboardEvent, MutableRefObject, RefObject } from "react";

import { SendIcon } from "@/app/admin/ui/crud-icons";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";

import { compactPersonaOptionLabel } from "./xchat-persona-label";

export type XchatComposerPanelProps = {
  handleSend: (e: FormEvent<HTMLFormElement>) => void;
  composerFormRef: RefObject<HTMLFormElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
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
  personaSelectRows,
  personaListError,
  personaPickerLocked,
  selectedPersonaId,
  setSelectedPersonaId,
  userPickedPersonaRef
}: XchatComposerPanelProps) {
  return (
    <div className="xchat-composer-wrap" id="xchat-composer">
      <form className="xchat-composer" onSubmit={handleSend} ref={composerFormRef}>
        <div className="xchat-composer__row xchat-composer__row--input">
          <XfHoverHint className="xchat-composer__input-grow" hint="Enter to send · Shift+Enter for a new line">
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
              placeholder={loading ? "Wait for reply…" : "What's on your mind?"}
              readOnly={loading}
              rows={1}
              value={input}
            />
          </XfHoverHint>
        </div>
        <div className="xchat-composer__row xchat-composer__row--actions">
          <div className="xchat-composer__persona-actions">
            <label className="sr-only" htmlFor="xchat-composer-persona-picker">
              Persona for this message
            </label>
            <XfHoverHint hint="Published persona for this prompt only — same list as the Persona rail">
              <select
                aria-label="Persona for this message"
                className="xchat-composer__persona-select xchat-composer__persona-select--inline"
                disabled={
                  personaSelectRows.length === 0 || Boolean(personaListError) || personaPickerLocked
                }
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
          <button className="xchat-composer__send" disabled={loading || !input.trim()} type="submit">
            <SendIcon className="crud-icon" />
            Send
          </button>
        </div>
      </form>
      <p className="xchat-composer-hint" role="note">
        <span className="xchat-composer-hint__pill">Beta</span>
        <span className="xchat-composer-hint__text">Composer shortcuts: Enter send · Shift+Enter newline</span>
      </p>
    </div>
  );
}
