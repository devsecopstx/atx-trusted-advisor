"use client";

import type { RefObject } from "react";

import { getXchatComposerTextareaMaxPx } from "@/lib/xchat/xchat-composer-textarea-max";

/** Matches `shouldRunOptionsActionScan` routing — natural language trigger for options scan. */
export const XCHAT_SCAN_OPTIONS_PROMPT =
  "Scan my options from holdings + watchlist.";

export function applyXchatScanOptionsPrompt(
  setInput: (v: string) => void,
  composerRef: RefObject<HTMLTextAreaElement | null>
): void {
  setInput(XCHAT_SCAN_OPTIONS_PROMPT);
  queueMicrotask(() => {
    const el = composerRef.current;
    if (el) {
      el.focus();
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, getXchatComposerTextareaMaxPx())}px`;
    }
  });
}

type XchatTemplatesWorkspaceBarProps = {
  promptLibraryCount: number;
  askInFlight: boolean;
};

export function XchatTemplatesWorkspaceBar({
  promptLibraryCount,
  askInFlight
}: XchatTemplatesWorkspaceBarProps) {
  return (
    <div className="xchat-workspace-bar" role="region" aria-label="Workspace status">
      <div className="xchat-workspace-bar__status" aria-live="polite">
        <span
          className={`xchat-workspace-bar__pulse${askInFlight ? " xchat-workspace-bar__pulse--live" : ""}`}
          aria-hidden
        />
        <div className="xchat-workspace-bar__status-copy">
          <span className="xchat-workspace-bar__status-line">
            {askInFlight ? "Advisor compiling…" : "Workspace library"}
          </span>
          <span aria-hidden className="xchat-workspace-bar__status-sep">
            ·
          </span>
          <span className="xchat-workspace-bar__status-meta">
            {askInFlight ? "Processing prompt" : `${promptLibraryCount} prompts ready`}
          </span>
        </div>
      </div>
    </div>
  );
}
