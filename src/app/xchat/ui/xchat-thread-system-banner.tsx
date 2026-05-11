"use client";

import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";

export type XchatThreadSystemBannerProps = {
  content: string;
  onDismiss?: () => void;
};

export function XchatThreadSystemBanner({ content, onDismiss }: XchatThreadSystemBannerProps) {
  return (
    <div
      className="xchat-thread-system-banner sticky top-0 z-10 mx-4 mt-2 rounded-xl border border-amber-500/30 bg-amber-950/80 p-4 text-sm text-[var(--xf-text-100)]"
      role="status"
    >
      <div className="xchat-thread-system-banner__body prose prose-invert prose-sm md:prose-base max-w-none">
        <XchatMarkdownBody className="xchat-markdown xchat-thread-system-banner__markdown" content={content} />
      </div>
      {onDismiss ? (
        <button
          className="xchat-thread-system-banner__dismiss"
          type="button"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
