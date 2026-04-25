"use client";

import { memo } from "react";

import { OptionsActionScanReport } from "@/app/reports/scan/ui/options-action-scan-report";
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
};

export const XchatThreadMessageBubble = memo(
  function XchatThreadMessageBubble({
    msg,
    emphasizeStrategyJobPrimary,
    strategyJobLaunchBusy,
    loading,
    onStrategyLaunch,
    onStrategyStay
  }: XchatThreadMessageBubbleProps) {
    return (
      <div className={`xchat-msg xchat-msg-${msg.role}`}>
        {msg.role === "ai" && msg.persona ? <small className="xchat-msg-ai__persona">{msg.persona}</small> : null}
        {msg.role === "ai" ? (
          msg.strategyJobOffer ? (
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
          )
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
    prev.emphasizeStrategyJobPrimary === next.emphasizeStrategyJobPrimary &&
    prev.strategyJobLaunchBusy === next.strategyJobLaunchBusy &&
    prev.loading === next.loading &&
    prev.onStrategyLaunch === next.onStrategyLaunch &&
    prev.onStrategyStay === next.onStrategyStay
);
