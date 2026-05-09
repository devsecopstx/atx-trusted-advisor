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
  threadId: string;
  onMessageFeedback?: (messageId: string, vote: "up" | "down") => void;
  onRegeneratePrompt?: (pairedPrompt: string) => void;
  onNewThread?: () => void;
  /** Earlier rows hidden when transcript is collapsed to the last N messages. */
  hiddenEarlierMessageCount?: number;
  onExpandEarlierMessages?: () => void;
  /** Workspace portfolio for `/xoptions` links inside embedded scan cards. */
  workspacePortfolioId?: string | null;
} & XchatThreadPanelCopyProps;

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
  activePersonaName,
  threadId,
  onMessageFeedback,
  onRegeneratePrompt,
  onNewThread,
  hiddenEarlierMessageCount = 0,
  onExpandEarlierMessages,
  workspacePortfolioId = null
}: XchatThreadPanelProps) {
  const latestAssistantMessage = [...messages].reverse().find((msg) => msg.role === "ai");
  const showRetainedContextBadge = latestAssistantMessage?.contextRetainedFromPriorTurns === true;
  return (
    <div className="xchat-thread-area">
      {threadUiCollapsed && messages.length > 0 && !loading ? (
        <button
          aria-expanded={false}
          className="xchat-thread-collapsed-bar"
          type="button"
          onClick={() => {
            setThreadUiCollapsed(false);
            queueMicrotask(() =>
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" })
            );
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
          className={`xchat-messages xchat-messages-container${threadMainVirtualize ? " xchat-messages--virtual-thread" : ""}${loading ? " xchat-messages-container--advisor-working" : ""}`}
        >
          {hiddenEarlierMessageCount > 0 && onExpandEarlierMessages ? (
            <button
              className="xchat-thread-expand-earlier"
              type="button"
              onClick={() => {
                onExpandEarlierMessages();
                queueMicrotask(() =>
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" })
                );
              }}
            >
              Show earlier messages ({hiddenEarlierMessageCount} hidden)
            </button>
          ) : null}
          {messages.length > 0 ? (
            <div className="xchat-thread-minimize-row">
              <button
                aria-expanded
                className="xchat-thread-minimize"
                type="button"
                onClick={() => setThreadUiCollapsed(true)}
              >
                <XchatThreadCollapseChevronIcon />
                <span>Minimize thread</span>
              </button>
              {onNewThread ? (
                <button className="xchat-thread-minimize" type="button" onClick={onNewThread}>
                  <span>New thread</span>
                </button>
              ) : null}
            </div>
          ) : null}
          {showRetainedContextBadge ? (
            <div className="xchat-thread-retained-badge">Context retained from prior turns</div>
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
                      onMessageFeedback={onMessageFeedback}
                      onRegeneratePrompt={onRegeneratePrompt}
                      strategyJobLaunchBusy={strategyJobLaunchBusy}
                      threadId={threadId}
                      workspacePortfolioId={workspacePortfolioId}
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
                onMessageFeedback={onMessageFeedback}
                onRegeneratePrompt={onRegeneratePrompt}
                strategyJobLaunchBusy={strategyJobLaunchBusy}
                threadId={threadId}
                workspacePortfolioId={workspacePortfolioId}
                onStrategyLaunch={onStrategyJobLaunch}
                onStrategyStay={onStrategyJobStay}
              />
            ))
          )}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
