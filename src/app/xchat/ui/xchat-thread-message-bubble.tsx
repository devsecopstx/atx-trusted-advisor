"use client";

import nextDynamic from "next/dynamic";
import { memo } from "react";

import { XchatAiResponseChrome } from "@/app/xchat/ui/xchat-ai-response-chrome";
import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";
import { XchatStrategyJobPreflightCards } from "@/app/xchat/ui/xchat-strategy-job-preflight";

import type { Message } from "./xchat-conversation-types";

/**
 * Perf: scan report pulls `jspdf`, `jspdf-autotable`, `@tanstack/react-query`,
 * `@tanstack/react-table`, and a chunky table UI — easily 200+ KB gzipped that
 * is irrelevant unless the AI returns an `optionsActionScan` payload (rare in
 * a typical thread). Lazy-load via `next/dynamic` so the chunk only ships when
 * a scan card is about to render. `ssr: false` matches the existing client-only
 * shape (the report uses browser APIs like `URL.createObjectURL`).
 */
const OptionsActionScanReportLazy = nextDynamic(
  () =>
    import("@/app/reports/scan/ui/options-action-scan-report").then((m) => ({
      default: m.OptionsActionScanReport
    })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        aria-label="Loading options action scan"
        className="options-action-scan-root options-action-scan-root--loading"
      />
    )
  }
);

export type XchatThreadMessageBubbleProps = {
  msg: Message;
  emphasizeStrategyJobPrimary: boolean;
  strategyJobLaunchBusy: boolean;
  loading: boolean;
  onStrategyLaunch: () => void;
  onStrategyStay: () => void;
  threadId: string;
  workspacePortfolioId?: string | null;
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
    workspacePortfolioId = null,
    onMessageFeedback,
    onRegeneratePrompt
  }: XchatThreadMessageBubbleProps) {
    const shouldUseLongResponseViewport =
      msg.role === "ai" &&
      !msg.strategyJobOffer &&
      !msg.optionsActionScan &&
      msg.content.trim().length >= 2500;

    return (
      <div className={`xchat-msg xchat-msg-${msg.role}`}>
        {msg.role === "error" ? (
          <div className="xchat-msg-error-body xchat-msg-ai-body--markdown">
            <XchatMarkdownBody content={msg.content} />
          </div>
        ) : msg.role === "ai" ? (
          <div className="xchat-msg-ai-turn">
            <div
              className={
                msg.strategyJobOffer || msg.optionsActionScan
                  ? "xchat-msg-ai-inner"
                  : "xchat-msg-ai-inner xchat-msg-ai-inner--markdown-turn"
              }
            >
              {msg.persona ? <small className="xchat-msg-ai__persona">{msg.persona}</small> : null}
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
                <div className="flex-1 overflow-y-auto xchat-msg-ai-body--scan">
                  <OptionsActionScanReportLazy
                    data={msg.optionsActionScan}
                    embeddedInThread
                    shareMode="enabled"
                    workspacePortfolioId={workspacePortfolioId}
                  />
                </div>
              ) : (
                <div
                  className={`xchat-msg-ai-body xchat-msg-ai-body--markdown${shouldUseLongResponseViewport ? " xchat-msg-ai-body--long-response" : ""}`}
                >
                  <XchatMarkdownBody content={msg.content} />
                </div>
              )}
            </div>
            <div className="xchat-msg-ai-toolbar" key={`chrome-${msg.id}`}>
              <XchatAiResponseChrome
                bodyText={msg.content}
                feedbackVote={msg.feedbackVote}
                interactionMeta={msg.interactionMeta}
                messageId={msg.id}
                pairedUserPrompt={msg.pairedUserPrompt}
                serverLogId={msg.serverLogId}
                threadId={threadId}
                variant="metaStrip"
                onFeedbackChange={onMessageFeedback}
                onRegenerate={onRegeneratePrompt}
              />
            </div>
          </div>
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
    prev.workspacePortfolioId === next.workspacePortfolioId &&
    prev.emphasizeStrategyJobPrimary === next.emphasizeStrategyJobPrimary &&
    prev.strategyJobLaunchBusy === next.strategyJobLaunchBusy &&
    prev.loading === next.loading &&
    prev.onStrategyLaunch === next.onStrategyLaunch &&
    prev.onStrategyStay === next.onStrategyStay &&
    prev.onMessageFeedback === next.onMessageFeedback &&
    prev.onRegeneratePrompt === next.onRegeneratePrompt
);
