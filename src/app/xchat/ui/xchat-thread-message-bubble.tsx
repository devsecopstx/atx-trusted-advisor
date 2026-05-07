"use client";

import { memo } from "react";

import { OptionsActionScanReport } from "@/app/reports/scan/ui/options-action-scan-report";
import { XchatAiResponseChrome } from "@/app/xchat/ui/xchat-ai-response-chrome";
import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";
import { XchatStrategyJobPreflightCards } from "@/app/xchat/ui/xchat-strategy-job-preflight";

import type { Message } from "./xchat-conversation-types";

export type XchatThreadMessageBubbleProps = {
  msg: Message;
  emphasizeStrategyJobPrimary: boolean;
  strategyJobLaunchBusy: boolean;
  loading: boolean;
  onStrategyLaunch: () => void;
  onStrategyStay: () => void;
  threadId: string;
  onMessageFeedback?: (messageId: string, vote: "up" | "down") => void;
  onRegeneratePrompt?: (pairedPrompt: string) => void;
};

export const XchatThreadMessageBubble = memo(
  function XchatThreadMessageBubble({
    msg,
    emphasizeStrategyJobPrimary,
    strategyJobLaunchBusy,
    loading,
    onStrategyLaunch,
    onStrategyStay,
    threadId,
    onMessageFeedback,
    onRegeneratePrompt
  }: XchatThreadMessageBubbleProps) {
    return (
      <div className={`xchat-msg xchat-msg-${msg.role}`}>
        {msg.role === "ai" && msg.persona ? <small className="xchat-msg-ai__persona">{msg.persona}</small> : null}
        {msg.role === "ai" ? (
          <>
            {msg.liveToolStatuses && msg.liveToolStatuses.length > 0 ? (
              <div className="xchat-live-tools" aria-live="polite">
                {msg.liveToolStatuses.map((t, i) => (
                  <span
                    key={`${t.name}-${t.phase}-${i}`}
                    className="xchat-live-tools__chip"
                    title={t.detail ?? undefined}
                  >
                    {t.name} · {t.phase}
                  </span>
                ))}
              </div>
            ) : null}
            {msg.strategyJobOffer ? (
              <XchatStrategyJobPreflightCards
                emphasizePrimary={emphasizeStrategyJobPrimary}
                launchBusy={strategyJobLaunchBusy}
                loading={loading}
                onLaunch={onStrategyLaunch}
                onStayInChat={onStrategyStay}
              />
            ) : msg.optionsActionScan ? (
              <OptionsActionScanReport data={msg.optionsActionScan} shareMode="enabled" />
            ) : (
              <XchatMarkdownBody content={msg.content} />
            )}
            <XchatAiResponseChrome
              bodyText={msg.content}
              feedbackVote={msg.feedbackVote}
              interactionMeta={msg.interactionMeta}
              messageId={msg.id}
              pairedUserPrompt={msg.pairedUserPrompt}
              serverLogId={msg.serverLogId}
              threadId={threadId}
              onFeedbackChange={onMessageFeedback}
              onRegenerate={onRegeneratePrompt}
            />
          </>
        ) : (
          <div className="xchat-msg-user-body">
            {msg.attachmentPreviewUrl ? (
              <div className="xchat-msg-user-body__image-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element -- thread shows data-URL paste only */}
                <img
                  alt="Pasted screenshot"
                  className="xchat-msg-user-body__image"
                  height={160}
                  src={msg.attachmentPreviewUrl}
                  width={280}
                />
              </div>
            ) : null}
            {msg.content.trim().length > 0 ? (
              <div className="xchat-msg-user-body__text">{msg.content}</div>
            ) : null}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.msg.id === next.msg.id &&
    prev.msg.role === next.msg.role &&
    prev.msg.content === next.msg.content &&
    prev.msg.attachmentPreviewUrl === next.msg.attachmentPreviewUrl &&
    prev.msg.persona === next.msg.persona &&
    prev.msg.strategyJobOffer === next.msg.strategyJobOffer &&
    prev.msg.optionsActionScan === next.msg.optionsActionScan &&
    prev.msg.interactionMeta === next.msg.interactionMeta &&
    prev.msg.liveToolStatuses === next.msg.liveToolStatuses &&
    prev.msg.pairedUserPrompt === next.msg.pairedUserPrompt &&
    prev.msg.feedbackVote === next.msg.feedbackVote &&
    prev.msg.serverLogId === next.msg.serverLogId &&
    prev.threadId === next.threadId &&
    prev.emphasizeStrategyJobPrimary === next.emphasizeStrategyJobPrimary &&
    prev.strategyJobLaunchBusy === next.strategyJobLaunchBusy &&
    prev.loading === next.loading &&
    prev.onStrategyLaunch === next.onStrategyLaunch &&
    prev.onStrategyStay === next.onStrategyStay &&
    prev.onMessageFeedback === next.onMessageFeedback &&
    prev.onRegeneratePrompt === next.onRegeneratePrompt
);
