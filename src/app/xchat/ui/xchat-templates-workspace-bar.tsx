"use client";

import { motion } from "framer-motion";
import type { RefObject } from "react";

/** Matches `shouldRunOptionsActionScan` routing — natural language trigger for options scan. */
export const XCHAT_SCAN_OPTIONS_PROMPT =
  "Scan my options from holdings + watchlist.";

type XchatTemplatesWorkspaceBarProps = {
  promptLibraryCount: number;
  askInFlight: boolean;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  setInput: (v: string) => void;
};

export function XchatTemplatesWorkspaceBar({
  promptLibraryCount,
  askInFlight,
  composerRef,
  setInput
}: XchatTemplatesWorkspaceBarProps) {
  function applyScanPrompt() {
    setInput(XCHAT_SCAN_OPTIONS_PROMPT);
    queueMicrotask(() => {
      const el = composerRef.current;
      if (el) {
        el.focus();
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
      }
    });
  }

  return (
    <div className="xchat-workspace-bar" role="region" aria-label="Workspace status and quick actions">
      <div className="xchat-workspace-bar__status" aria-live="polite">
        <span
          className={`xchat-workspace-bar__pulse${askInFlight ? " xchat-workspace-bar__pulse--live" : ""}`}
          aria-hidden
        />
        <div className="xchat-workspace-bar__status-copy">
          <span className="xchat-workspace-bar__status-line">
            {askInFlight ? "Advisor compiling…" : "Workspace library"}
          </span>
          <span className="xchat-workspace-bar__status-meta">
            {askInFlight ? "xChat is processing your prompt" : `${promptLibraryCount} prompts ready`}
          </span>
        </div>
      </div>
      <motion.button
        aria-busy={askInFlight}
        aria-label="Insert scan my options prompt into composer, then review and send"
        className="xchat-workspace-bar__scan"
        disabled={askInFlight}
        type="button"
        whileHover={{ scale: askInFlight ? 1 : 1.01 }}
        whileTap={{ scale: askInFlight ? 1 : 0.98 }}
        onClick={applyScanPrompt}
      >
        Scan my options
      </motion.button>
    </div>
  );
}
