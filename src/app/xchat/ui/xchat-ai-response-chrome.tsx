"use client";

import { useCallback, useState } from "react";

import type { XchatInteractionMeta } from "@/app/xchat/ui/xchat-conversation-types";

export function pickXchatClosingLine(markdown: string): string {
  const t = markdown.toLowerCase();
  if (t.includes("|") && (t.includes("---") || t.includes("|--"))) {
    return "Tables are snapshots — refresh quotes and venue depth before routing size.";
  }
  if (/\bwatchlist\b|\btarget entry\b|\bspot\b.*\$/.test(t)) {
    return "Cross-check live quotes and liquidity before sizing.";
  }
  if (/\bcall\b|\bput\b|\bspread\b|\biv\b|\bgreeks\b|\bcovered call\b|\bprotective put\b|\bstraddle\b/.test(t)) {
    return "Validate Greeks, collateral, and assignment scenarios before sending orders.";
  }
  return "Educational context only — not personalized advice. Ready when you are.";
}

function stripMarkdownForSpeech(raw: string): string {
  let s = raw.replace(/\[[^\]]*]\([^)]*\)/g, " ");
  s = s.replace(/[#*_`>|]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, 12000);
}

function IconCopy() {
  return (
    <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 1 7 0l2 2a5 5 0 0 1-7.07 7.07l-1.42-1.41" />
      <path d="M14 11a5 5 0 0 1-7 0l-2-2a5 5 0 0 1 7.07-7.07l1.41 1.41" />
    </svg>
  );
}

function IconRegen() {
  return (
    <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconSpeak() {
  return (
    <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 5L6 9H2v6h4l5 4V5zm4.5 4.5a4.5 4.5 0 0 1 0 9v-2a2.5 2.5 0 0 0 0-5v-2zm0-4a8.5 8.5 0 0 1 0 17v-2a6.5 6.5 0 0 0 0-13v-2z" />
    </svg>
  );
}

function IconThumbUp() {
  return (
    <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5v12H5V10h5l-1-4.12a2 2 0 0 1 3.67-.76l1 4.88" />
    </svg>
  );
}

function IconThumbDown() {
  return (
    <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H5v-12h14v12h-5l1 4.88a2 2 0 0 1-3.67.76l-1-4.88" />
    </svg>
  );
}

export type XchatAiResponseChromeProps = {
  messageId: string;
  /** Markdown or plain assistant text to copy / speak. */
  bodyText: string;
  threadId: string;
  serverLogId?: string;
  interactionMeta?: XchatInteractionMeta;
  pairedUserPrompt?: string;
  feedbackVote?: "up" | "down" | null;
  onFeedbackChange?: (messageId: string, vote: "up" | "down") => void;
  onRegenerate?: (pairedPrompt: string) => void;
};

export function XchatAiResponseChrome({
  messageId,
  bodyText,
  threadId,
  serverLogId,
  interactionMeta,
  pairedUserPrompt,
  feedbackVote,
  onFeedbackChange,
  onRegenerate
}: XchatAiResponseChromeProps) {
  const [copyDone, setCopyDone] = useState(false);
  const [linkDone, setLinkDone] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const closing = pickXchatClosingLine(bodyText);
  const hasDuration =
    interactionMeta !== undefined &&
    typeof interactionMeta.generationMs === "number" &&
    interactionMeta.generationMs > 0;
  const secondsLabel = hasDuration
    ? (interactionMeta.generationMs / 1000).toFixed(1)
    : null;
  const src = interactionMeta?.sources;
  const sourcesTotal = src ? src.total : null;
  const statsTitle =
    src != null
      ? [
          `RAG snippets: ${src.ragChunks}`,
          `Tool calls: ${src.toolInvocations}`,
          src.personaCollections > 0 ? `Persona collections: ${src.personaCollections}` : null
        ]
          .filter(Boolean)
          .join(" · ")
      : "Source counts unavailable for this turn.";

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bodyText);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [bodyText]);

  const copyShareLink = useCallback(async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("thread", threadId);
      if (serverLogId) {
        url.searchParams.set("turn", serverLogId);
      }
      await navigator.clipboard.writeText(url.toString());
      setLinkDone(true);
      window.setTimeout(() => setLinkDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [threadId, serverLogId]);

  const submitFeedback = useCallback(
    async (vote: "up" | "down") => {
      if (!serverLogId || feedbackBusy) {
        return;
      }
      setFeedbackBusy(true);
      try {
        const res = await fetch("/api/xchat/message-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logId: serverLogId, vote })
        });
        if (res.ok) {
          onFeedbackChange?.(messageId, vote);
        }
      } finally {
        setFeedbackBusy(false);
      }
    },
    [serverLogId, feedbackBusy, messageId, onFeedbackChange]
  );

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripMarkdownForSpeech(bodyText));
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }, [bodyText]);

  const regen = useCallback(() => {
    const p = pairedUserPrompt?.trim();
    if (p) {
      onRegenerate?.(p);
    }
  }, [pairedUserPrompt, onRegenerate]);

  const feedbackDisabled = !serverLogId || feedbackBusy;

  return (
    <footer className="xchat-ai-response-chrome">
      <div className="xchat-ai-response-chrome__divider" aria-hidden />
      <p className="xchat-ai-response-chrome__closing">{closing}</p>
      <div className="xchat-ai-response-chrome__bar">
        <div className="xchat-ai-response-chrome__actions" role="toolbar" aria-label="Response actions">
          <button
            type="button"
            className="xchat-ai-response-chrome__btn"
            onClick={() => void copyAll()}
            aria-label="Copy entire response"
            title={copyDone ? "Copied" : "Copy response"}
          >
            <IconCopy />
            <span className="xchat-ai-response-chrome__btn-label">{copyDone ? "Copied" : "Copy"}</span>
          </button>
          <button
            type="button"
            className="xchat-ai-response-chrome__btn"
            onClick={() => void copyShareLink()}
            aria-label="Copy link to this thread and turn"
            title={linkDone ? "Link copied" : "Copy shareable link"}
          >
            <IconLink />
            <span className="xchat-ai-response-chrome__btn-label">{linkDone ? "Linked" : "Link"}</span>
          </button>
          <button
            type="button"
            className={`xchat-ai-response-chrome__btn${feedbackVote === "up" ? " xchat-ai-response-chrome__btn--active" : ""}`}
            disabled={feedbackDisabled}
            onClick={() => void submitFeedback("up")}
            aria-label="Thumbs up"
            title={serverLogId ? "Good response" : "Enable history to leave feedback"}
          >
            <IconThumbUp />
          </button>
          <button
            type="button"
            className={`xchat-ai-response-chrome__btn${feedbackVote === "down" ? " xchat-ai-response-chrome__btn--active" : ""}`}
            disabled={feedbackDisabled}
            onClick={() => void submitFeedback("down")}
            aria-label="Thumbs down"
            title={serverLogId ? "Poor response" : "Enable history to leave feedback"}
          >
            <IconThumbDown />
          </button>
          <button
            type="button"
            className="xchat-ai-response-chrome__btn"
            disabled={!pairedUserPrompt?.trim()}
            onClick={regen}
            aria-label="Regenerate — loads prompt into composer"
            title="Reload last prompt into composer — press Send to regenerate"
          >
            <IconRegen />
            <span className="xchat-ai-response-chrome__btn-label">Regenerate</span>
          </button>
          <button type="button" className="xchat-ai-response-chrome__btn" onClick={speak} aria-label="Speak response">
            <IconSpeak />
            <span className="xchat-ai-response-chrome__btn-label">Speak</span>
          </button>
        </div>
        <div className="xchat-ai-response-chrome__stats" aria-label="Response stats">
          <span className="xchat-ai-response-chrome__stat-time" title="Wall-clock time for this answer">
            {secondsLabel !== null ? `${secondsLabel}s` : "—"}
          </span>
          <span className="xchat-ai-response-chrome__stat-pill" title={statsTitle}>
            {sourcesTotal !== null ? `${sourcesTotal} sources` : "—"}
          </span>
        </div>
      </div>
    </footer>
  );
}
