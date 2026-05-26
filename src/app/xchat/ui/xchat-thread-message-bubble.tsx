"use client";

import nextDynamic from "next/dynamic";
import { memo, useState } from "react";

import { XchatAiResponseChrome } from "@/app/xchat/ui/xchat-ai-response-chrome";
import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";
import { XchatStrategyJobPreflightCards } from "@/app/xchat/ui/xchat-strategy-job-preflight";
import { XchatThreadAvatar } from "@/app/xchat/ui/xchat-thread-avatar";

import type { Message } from "./xchat-conversation-types";

/**
 * Perf: scan report pulls `jspdf`, `jspdf-autotable`, `@tanstack/react-query`,
 * `@tanstack/react-table`, and a chunky table UI — easily 200+ KB gzipped that
 * is irrelevant unless the AI returns an `optionsActionScan` payload (rare in
 * a typical thread). Lazy-load via `next/dynamic` so the chunk only ships when
 * a scan card is about to render. `ssr: false` matches the existing client-only
 * shape (the report uses browser APIs like `URL.createObjectURL`).
 */
const XCHAT_ASSISTANT_COLLAPSE_CHAR_THRESHOLD = 800;

function XchatCollapsibleAssistantMarkdown({ content }: { content: string }) {
  const [markdownExpanded, setMarkdownExpanded] = useState(true);

  return (
    <>
      <div
        className={
          !markdownExpanded ? "xchat-msg-ai-body__markdown-preview" : undefined
        }
      >
        <XchatMarkdownBody content={content} />
      </div>
      <button
        className="xchat-msg-ai-body__toggle"
        type="button"
        onClick={() => setMarkdownExpanded((prev) => !prev)}
      >
        {markdownExpanded ? "Collapse response" : "Expand response"}
      </button>
    </>
  );
}

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
  userAvatarUrl?: string | null;
  userDisplayName?: string | null;
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
    userAvatarUrl = null,
    userDisplayName = null,
    onMessageFeedback,
    onRegeneratePrompt
  }: XchatThreadMessageBubbleProps) {
    const hasScanRows = Boolean(msg.optionsActionScan && msg.optionsActionScan.rows.length > 0);
    const hasAssistantText = msg.content.trim().length > 0;
    const isCollapsibleMarkdown =
      msg.role === "ai" &&
      !msg.strategyJobOffer &&
      !msg.optionsActionScan &&
      msg.content.trim().length > XCHAT_ASSISTANT_COLLAPSE_CHAR_THRESHOLD;
    const renderMarkdownBody = (content: string) =>
      isCollapsibleMarkdown ? (
        <XchatCollapsibleAssistantMarkdown key={msg.id} content={content} />
      ) : (
        <XchatMarkdownBody content={content} />
      );

    const avatarRole = msg.role === "user" ? "user" : "ai";

    return (
      <div className={`xchat-msg xchat-msg-${msg.role} xchat-msg--with-avatar`}>
        {msg.role !== "error" ? (
          <XchatThreadAvatar
            role={avatarRole}
            userAvatarUrl={userAvatarUrl}
            userDisplayName={userDisplayName}
          />
        ) : null}
        <div className="xchat-msg__body-col">
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
                  workspacePortfolioId={workspacePortfolioId}
                  onLaunch={onStrategyLaunch}
                  onStayInChat={onStrategyStay}
                />
              ) : msg.optionsActionScan ? (
                hasScanRows ? (
                  <div className="xchat-msg-ai-body xchat-msg-ai-body--scan">
                    <OptionsActionScanReportLazy
                      data={msg.optionsActionScan}
                      embeddedInThread
                      shareMode="enabled"
                      workspacePortfolioId={workspacePortfolioId}
                    />
                  </div>
                ) : hasAssistantText ? (
                  <div className="xchat-msg-ai-body xchat-msg-ai-body--markdown">
                    {renderMarkdownBody(msg.content)}
                  </div>
                ) : (
                  <div className="xchat-msg-ai-body xchat-msg-ai-body--markdown">
                    <p className="status-text status-error">No content received from advisor for this scan.</p>
                  </div>
                )
              ) : (
                <div className="xchat-msg-ai-body xchat-msg-ai-body--markdown">
                  {renderMarkdownBody(msg.content)}
                </div>
              )}
            </div>
            <div className="xchat-msg-ai-toolbar">
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
          <div className={`xchat-msg-user-body${msg.attachmentPreviewUrl ? " xchat-msg-user-body--with-image" : ""}`}>
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
    prev.userAvatarUrl === next.userAvatarUrl &&
    prev.userDisplayName === next.userDisplayName &&
    prev.emphasizeStrategyJobPrimary === next.emphasizeStrategyJobPrimary &&
    prev.strategyJobLaunchBusy === next.strategyJobLaunchBusy &&
    prev.loading === next.loading &&
    prev.onStrategyLaunch === next.onStrategyLaunch &&
    prev.onStrategyStay === next.onStrategyStay &&
    prev.onMessageFeedback === next.onMessageFeedback &&
    prev.onRegeneratePrompt === next.onRegeneratePrompt
);
