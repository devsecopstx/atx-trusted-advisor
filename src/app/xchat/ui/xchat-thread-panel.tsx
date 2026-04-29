"use client";

import type { Virtualizer } from "@tanstack/virtual-core";
import type { RefObject } from "react";

import { XchatThreadMessageBubble } from "@/app/xchat/ui/xchat-thread-message-bubble";

import type { Message } from "./xchat-conversation-types";

/** Persona name for empty-thread copy (matches main xChat welcome). */
export type XchatThreadPanelCopyProps = {
  activePersonaName: string;
};

function XchatThreadExpandChevronIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={22} viewBox="0 0 24 24" width={22}>
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41z" />
    </svg>
  );
}

function XchatThreadCollapseChevronIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={18} viewBox="0 0 24 24" width={18}>
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" />
    </svg>
  );
}

export type XchatThreadPanelProps = {
  threadUiCollapsed: boolean;
  setThreadUiCollapsed: (next: boolean) => void;
  messages: Message[];
  loading: boolean;
  threadMainVirtualize: boolean;
  threadVirtualizer: Virtualizer<HTMLDivElement, Element>;
  visibleThreadMessages: Message[];
  emphasizeStrategyJobPrimary: (aiMsgId: string) => boolean;
  strategyJobLaunchBusy: boolean;
  onStrategyJobLaunch: () => void;
  onStrategyJobStay: () => void;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  threadScrollRef: RefObject<HTMLDivElement | null>;
  threadUiSummary: { userTurnCount: number; preview: string };
  askElapsedMs: number;
  /** Stop in-flight prompt (same client abort as composer Stop). */
  onCancelAsk?: () => void;
} & XchatThreadPanelCopyProps;

function formatXchatTradingClock(ms: number): string {
  if (ms < 80) {
    return "00:00.0";
  }
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

export function XchatThreadPanel({
  threadUiCollapsed,
  setThreadUiCollapsed,
  messages,
  loading,
  threadMainVirtualize,
  threadVirtualizer,
  visibleThreadMessages,
  emphasizeStrategyJobPrimary,
  strategyJobLaunchBusy,
  onStrategyJobLaunch,
  onStrategyJobStay,
  messagesEndRef,
  threadScrollRef,
  threadUiSummary,
  askElapsedMs,
  activePersonaName,
  onCancelAsk
}: XchatThreadPanelProps) {
  const askWaitSeconds = Math.floor(askElapsedMs / 1000);
  return (
    <div className="xchat-thread-area">
      {threadUiCollapsed && messages.length > 0 && !loading ? (
        <button
          aria-expanded={false}
          className="xchat-thread-collapsed-bar"
          type="button"
          onClick={() => {
            setThreadUiCollapsed(false);
            queueMicrotask(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }));
          }}
        >
          <span aria-hidden className="xchat-thread-collapsed-bar__icon">
            <XchatThreadExpandChevronIcon />
          </span>
          <span className="xchat-thread-collapsed-bar__meta">
            <span className="xchat-thread-collapsed-bar__title">
              {loading
                ? "Assistant is replying…"
                : `Conversation · ${threadUiSummary.userTurnCount} prompt${threadUiSummary.userTurnCount === 1 ? "" : "s"}`}
            </span>
            {threadUiSummary.preview ? (
              <span className="xchat-thread-collapsed-bar__preview">{threadUiSummary.preview}</span>
            ) : null}
          </span>
          <span className="xchat-thread-collapsed-bar__action">Expand</span>
        </button>
      ) : (
        <div
          ref={threadScrollRef}
          className={`xchat-messages${threadMainVirtualize ? " xchat-messages--virtual-thread" : ""}`}
        >
          {messages.length > 0 ? (
            <button
              aria-expanded
              className="xchat-thread-minimize"
              type="button"
              onClick={() => setThreadUiCollapsed(true)}
            >
              <XchatThreadCollapseChevronIcon />
              <span>Minimize thread</span>
            </button>
          ) : null}

          {messages.length === 0 ? (
            <div className="xchat-messages-empty">
              <p className="status-text">
                Start a conversation with <strong>{activePersonaName}</strong> (or choose another published persona in the
                composer).
              </p>
            </div>
          ) : null}

          {threadMainVirtualize ? (
            <div
              className="xchat-messages__virtual-wrap"
              style={{
                height: threadVirtualizer.getTotalSize(),
                position: "relative",
                width: "100%"
              }}
            >
              {threadVirtualizer.getVirtualItems().map((vi) => {
                const msg = visibleThreadMessages[vi.index]!;
                return (
                  <div
                    key={msg.id}
                    className="xchat-msg-virtual-row"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      minHeight: vi.size,
                      transform: `translateY(${vi.start}px)`
                    }}
                  >
                    <XchatThreadMessageBubble
                      emphasizeStrategyJobPrimary={emphasizeStrategyJobPrimary(msg.id)}
                      loading={loading}
                      msg={msg}
                      strategyJobLaunchBusy={strategyJobLaunchBusy}
                      onStrategyLaunch={onStrategyJobLaunch}
                      onStrategyStay={onStrategyJobStay}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            visibleThreadMessages.map((msg) => (
              <XchatThreadMessageBubble
                key={msg.id}
                emphasizeStrategyJobPrimary={emphasizeStrategyJobPrimary(msg.id)}
                loading={loading}
                msg={msg}
                strategyJobLaunchBusy={strategyJobLaunchBusy}
                onStrategyLaunch={onStrategyJobLaunch}
                onStrategyStay={onStrategyJobStay}
              />
            ))
          )}

          {loading ? (
            <div aria-busy="true" aria-live="polite" className="xchat-await" role="status">
              <div className="xchat-await__row">
                <div className="xchat-typing" aria-hidden>
                  <span className="xchat-typing-dot" />
                  <span className="xchat-typing-dot" />
                  <span className="xchat-typing-dot" />
                </div>
                <div className="xchat-await__copy">
                  <span className="xchat-await__title">Advisor is working</span>
                  <span className="xchat-await__hint">
                    {askWaitSeconds >= 10
                      ? "Still running — portfolio or market tools can take up to a minute."
                      : askWaitSeconds >= 3
                        ? "Your persona may be calling workspace or Yahoo tools…"
                        : "Sending to xAI…"}
                  </span>
                  <span
                    className="xchat-await__timer"
                    aria-label={`Elapsed ${askWaitSeconds} seconds`}
                  >
                    {formatXchatTradingClock(askElapsedMs)}
                  </span>
                </div>
                {onCancelAsk ? (
                  <button
                    aria-label="Stop generating"
                    className="xchat-await__stop"
                    type="button"
                    onClick={() => {
                      onCancelAsk();
                    }}
                  >
                    Stop
                  </button>
                ) : null}
              </div>
              <div aria-hidden className="xchat-await__skeleton">
                <div className="xchat-await__sk-track xchat-await__sk-track--long">
                  <span className="xchat-await__sk-line" />
                </div>
                <div className="xchat-await__sk-track xchat-await__sk-track--med">
                  <span className="xchat-await__sk-line" />
                </div>
                <div className="xchat-await__sk-track xchat-await__sk-track--short">
                  <span className="xchat-await__sk-line" />
                </div>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
