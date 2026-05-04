"use client";

import { useEffect, useId, useState } from "react";

import {
    XCHAT_VOICE_PRESETS,
    type XchatVoicePresetId,
    type XchatVoiceTurnMode
} from "@/modules/xchat/voice/types";

import { useXchatVoiceRealtimeSession } from "./useXchatVoiceRealtimeSession";

export type VoiceModeSessionProps = {
  open: boolean;
  onClose: () => void;
  /** Resolved persona label for voice instructions (matches thread persona name when possible). */
  personaLabel: string;
  /** When true (e.g. xChat ask in flight), tear down voice session. */
  disabled?: boolean;
};

export function VoiceModeSession({
  open,
  onClose,
  personaLabel,
  disabled = false
}: VoiceModeSessionProps) {
  const titleId = useId();
  const [voice, setVoice] = useState<XchatVoicePresetId>("eve");
  const [turnMode, setTurnMode] = useState<XchatVoiceTurnMode>("vad");

  const {
    status,
    errorMessage,
    userCaption,
    assistantCaption,
    connect,
    disconnect,
    interruptAssistant,
    pushPointerDown,
    pushPointerUp
  } = useXchatVoiceRealtimeSession();

  useEffect(() => {
    if (!open || disabled) {
      disconnect();
      return;
    }
    void connect({ personaLabel, voice, turnMode });
    return () => disconnect();
  }, [open, disabled, personaLabel, voice, turnMode, connect, disconnect]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const statusLabel =
    status === "idle"
      ? "Idle"
      : status === "connecting"
        ? "Connecting…"
        : status === "live"
          ? "Live"
          : "Error";

  return (
    <div
      aria-labelledby={titleId}
      aria-modal
      className="xchat-voice-mode"
      role="dialog"
    >
      <button
        aria-label="Close voice mode"
        className="xchat-voice-mode__backdrop"
        type="button"
        onClick={() => {
          onClose();
        }}
      />
      <div className="xchat-voice-mode__panel">
        <div className="xchat-voice-mode__header">
          <h2 className="xchat-voice-mode__title" id={titleId}>
            Voice chat
          </h2>
          <span className={`xchat-voice-mode__status xchat-voice-mode__status--${status}`}>
            {statusLabel}
          </span>
          <button className="xchat-voice-mode__close" type="button" onClick={() => onClose()}>
            Close
          </button>
        </div>

        <p className="xchat-voice-mode__meta">
          Persona: <strong>{personaLabel}</strong> · xAI Voice realtime · Workspace snapshot in session when available · Not financial
          advice.
        </p>

        <div className="xchat-voice-mode__controls">
          <label className="xchat-voice-mode__field">
            <span>Voice</span>
            <select
              value={voice}
              onChange={(e) => {
                setVoice(e.target.value as XchatVoicePresetId);
              }}
            >
              {XCHAT_VOICE_PRESETS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="xchat-voice-mode__field">
            <span>Turns</span>
            <select
              value={turnMode}
              onChange={(e) => {
                setTurnMode(e.target.value as XchatVoiceTurnMode);
              }}
            >
              <option value="vad">Auto (detect speech)</option>
              <option value="push">Push to talk</option>
            </select>
          </label>

          <button
            className="xchat-voice-mode__btn xchat-voice-mode__btn--secondary"
            disabled={status !== "live"}
            type="button"
            onClick={() => interruptAssistant()}
          >
            Interrupt
          </button>
        </div>

        {turnMode === "push" ? (
          <button
            className="xchat-voice-mode__ptt"
            disabled={status !== "live"}
            type="button"
            onPointerDown={() => pushPointerDown()}
            onPointerLeave={() => pushPointerUp()}
            onPointerUp={() => pushPointerUp()}
          >
            Hold to speak
          </button>
        ) : (
          <p className="xchat-voice-mode__hint">Speak naturally — the server detects when you finish.</p>
        )}

        {errorMessage ? (
          <p className="status-text status-error xchat-voice-mode__err" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="xchat-voice-mode__captions">
          <section className="xchat-voice-mode__caption-block">
            <h3 className="xchat-voice-mode__caption-label">You</h3>
            <pre className="xchat-voice-mode__caption-text">{userCaption.trim() || "…"}</pre>
          </section>
          <section className="xchat-voice-mode__caption-block">
            <h3 className="xchat-voice-mode__caption-label">Grok</h3>
            <pre className="xchat-voice-mode__caption-text">{assistantCaption.trim() || "…"}</pre>
          </section>
        </div>
      </div>
    </div>
  );
}
