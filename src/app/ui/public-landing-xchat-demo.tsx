"use client";

import { SendIcon } from "@/app/admin/ui/crud-icons";
import { RailSidebarZapIcon } from "@/app/ui/rail-sidebar-zap-icon";
import { XfHoverHint } from "@/app/ui/xf-hover-hint";
import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";
import "@/app/xchat/xchat.css";

import { useCallback, useEffect, useRef, useState } from "react";

import "./public-landing-xchat-demo.css";

const USER_PROMPT = "add CIFR to my watchlist";

const AI_MARKDOWN = `CIFR was already on your **DefaultWatchlist** (upsert confirmed; Stock/balanced defaults applied). Current spot: **$16.98** (100× target notional: **$1,698**).

**Updated watchlist (9 items):**
- TSLA: $346.72 / $34,672
- NVDA: $188.53 / $18,853
- AAPL: $259.94 / $25,994
- AMD: $112.40 / $11,240
- MSFT: $415.22 / $41,522
- GOOGL: $191.10 / $19,110
- META: $602.88 / $60,288
- PLTR: $78.44 / $7,844
- CIFR: $16.98 / $1,698

Say **show my watchlist** for full details/rationale.`;

function XchatThreadCollapseChevronIcon() {
  return (
    <svg aria-hidden fill="currentColor" height={18} viewBox="0 0 24 24" width={18}>
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z" />
    </svg>
  );
}

function RailChatGlyph() {
  return (
    <svg aria-hidden fill="none" height={18} viewBox="0 0 24 24" width={18}>
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
    </svg>
  );
}

function RailBookGlyph() {
  return (
    <svg aria-hidden fill="none" height={18} viewBox="0 0 24 24" width={18}>
      <path
        d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014.5 17 2.5 2.5 0 014 14.5V5a2 2 0 012-2h12v16M6.5 17H20V5H6.5a2 2 0 00-2 2v10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.65}
      />
    </svg>
  );
}

function RailChevronsGlyph() {
  return (
    <svg aria-hidden fill="currentColor" height={16} viewBox="0 0 24 24" width={16}>
      <path d="M6.41 6L5 7.41 9.58 12 5 16.59 6.41 18l6-6-6-6zm8 0L13 7.41 17.58 12 13 16.59 14.41 18l6-6-6-6z" />
    </svg>
  );
}

function splitStreamChunks(text: string): string[] {
  const parts = text.split(/(\s+)/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of parts) {
    buf += p;
    if (buf.length >= 56 || (p.includes("\n") && buf.length > 8)) {
      chunks.push(buf);
      buf = "";
    }
  }
  if (buf.length > 0) {
    chunks.push(buf);
  }
  return chunks;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function PublicLandingXchatDemo() {
  const reducedMotion = usePrefersReducedMotion();
  const timeoutsRef = useRef<number[]>([]);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  const [composerValue, setComposerValue] = useState("");
  const [showUserBubble, setShowUserBubble] = useState(false);
  const [showAwaiting, setShowAwaiting] = useState(false);
  const [aiContent, setAiContent] = useState("");
  const [composerBusy, setComposerBusy] = useState(false);
  const [runId, setRunId] = useState(0);

  const clearTimers = useCallback(() => {
    for (const id of timeoutsRef.current) {
      clearTimeout(id);
    }
    timeoutsRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const scrollToEnd = useCallback(() => {
    queueMicrotask(() => {
      const el = messagesScrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [showUserBubble, showAwaiting, aiContent, scrollToEnd]);

  useEffect(() => {
    clearTimers();
    setComposerValue("");
    setShowUserBubble(false);
    setShowAwaiting(false);
    setAiContent("");
    setComposerBusy(false);

    const chunks = splitStreamChunks(AI_MARKDOWN);
    let chunkIdx = 0;

    const typeMs = reducedMotion ? 0 : 38;
    const pauseBeforeType = reducedMotion ? 200 : 900;
    const pauseAfterType = reducedMotion ? 150 : 520;
    const awaitingMs = reducedMotion ? 400 : 1500;
    const chunkGap = reducedMotion ? 0 : 42;

    const afterIntro = () => {
      if (reducedMotion) {
        setComposerValue(USER_PROMPT);
        schedule(() => {
          setComposerValue("");
          setShowUserBubble(true);
          setComposerBusy(true);
          schedule(() => {
            setShowAwaiting(true);
            schedule(() => {
              setShowAwaiting(false);
              setAiContent(AI_MARKDOWN);
              setComposerBusy(false);
              schedule(() => setRunId((k) => k + 1), 8000);
            }, awaitingMs);
          }, 200);
        }, pauseAfterType);
        return;
      }

      let i = 0;
      const typeNext = () => {
        if (i >= USER_PROMPT.length) {
          schedule(() => {
            setComposerValue("");
            setShowUserBubble(true);
            setComposerBusy(true);
            scrollToEnd();
            schedule(() => {
              setShowAwaiting(true);
              schedule(() => {
                setShowAwaiting(false);
                const pushChunk = () => {
                  if (chunkIdx >= chunks.length) {
                    setComposerBusy(false);
                    schedule(() => setRunId((k) => k + 1), 8000);
                    return;
                  }
                  setAiContent((prev) => prev + chunks[chunkIdx]!);
                  chunkIdx += 1;
                  schedule(pushChunk, chunkGap);
                };
                pushChunk();
              }, awaitingMs);
            }, 280);
          }, pauseAfterType);
          return;
        }
        i += 1;
        setComposerValue(USER_PROMPT.slice(0, i));
        schedule(typeNext, typeMs);
      };

      schedule(typeNext, pauseBeforeType);
    };

    schedule(afterIntro, reducedMotion ? 120 : 650);

    return () => clearTimers();
  }, [runId, reducedMotion, clearTimers, schedule, scrollToEnd]);

  const onReplay = () => {
    clearTimers();
    setRunId((k) => k + 1);
  };

  const showThreadChrome = showUserBubble || showAwaiting || aiContent.length > 0;

  return (
    <div className="pl-public-xchat-demo" id="xchat-demo">
      <div
        aria-label="xChat interface demonstration"
        className="pl-public-xchat-demo__shell xchat-main-shell"
        role="region"
      >
        <aside className="pl-public-xchat-demo__rail" aria-hidden>
          <button className="xchat-rail-toggle" type="button" tabIndex={-1}>
            <RailSidebarZapIcon className="xchat-rail-toggle__glyph" />
          </button>
          <div className="pl-public-xchat-demo__rail-mid">
            <span className="pl-public-xchat-demo__rail-icon pl-public-xchat-demo__rail-icon--active" title="Chat">
              <RailChatGlyph />
            </span>
            <span className="pl-public-xchat-demo__rail-icon" title="Reference">
              <RailBookGlyph />
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="pl-public-xchat-demo__rail-icon" title="">
              <RailChevronsGlyph />
            </span>
            <div className="pl-public-xchat-demo__rail-avatar" />
          </div>
        </aside>

        <div className="xchat-main">
          <div className="xchat-thread-area">
            <div className="xchat-messages" ref={messagesScrollRef}>
              {showThreadChrome ? (
                <button className="xchat-thread-minimize" tabIndex={-1} type="button">
                  <XchatThreadCollapseChevronIcon />
                  <span>Minimize thread</span>
                </button>
              ) : null}

              {showUserBubble ? (
                <div className="xchat-msg xchat-msg-user">
                  <div className="xchat-msg-user-body">
                    <div className="xchat-msg-user-body__text">{USER_PROMPT}</div>
                  </div>
                </div>
              ) : null}

              {showAwaiting ? (
                <div aria-busy="true" aria-live="polite" className="xchat-await" role="status">
                  <div className="xchat-await__row">
                    <div aria-hidden className="xchat-typing">
                      <span className="xchat-typing-dot" />
                      <span className="xchat-typing-dot" />
                      <span className="xchat-typing-dot" />
                    </div>
                    <div className="xchat-await__copy">
                      <span className="xchat-await__title">Advisor is working</span>
                      <span className="xchat-await__hint">Sending to xAI…</span>
                      <span aria-label="Elapsed time" className="xchat-await__timer">
                        00:00.0
                      </span>
                    </div>
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

              {aiContent.length > 0 ? (
                <div aria-live="polite" className="xchat-msg xchat-msg-ai">
                  <small className="xchat-msg-ai__persona">advisor</small>
                  <XchatMarkdownBody content={aiContent} />
                </div>
              ) : null}

            </div>
          </div>

          <div className="xchat-composer-wrap" id="xchat-composer-demo">
            <form
              className="xchat-composer"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="xchat-composer__row xchat-composer__row--input">
                <XfHoverHint
                  className="xchat-composer__input-grow"
                  hint="Enter to send · Shift+Enter newline · Paste image (screenshot) to analyze"
                >
                  <textarea
                    readOnly
                    aria-label="Message composer demonstration"
                    className="xchat-composer__field xchat-composer__textarea"
                    rows={2}
                    value={composerValue}
                    placeholder={composerBusy ? "Wait for reply…" : "What's on your mind?"}
                  />
                </XfHoverHint>
              </div>
              <div className="xchat-composer__row xchat-composer__row--actions">
                <div className="xchat-composer__persona-actions">
                  <label className="sr-only" htmlFor="pl-xchat-demo-persona">
                    Persona for this message
                  </label>
                  <select
                    aria-label="Persona for this message"
                    className="xchat-composer__persona-select xchat-composer__persona-select--inline"
                    disabled
                    id="pl-xchat-demo-persona"
                    value=""
                  >
                    <option value="">Default</option>
                  </select>
                </div>
                <button className="xchat-composer__send" disabled type="submit">
                  <SendIcon className="crud-icon" />
                  Send
                </button>
              </div>
            </form>
            <p className="xchat-composer-hint" role="note">
              <span className="xchat-composer-hint__pill">Beta</span>
              <span className="xchat-composer-hint__text">
                Enter send · Shift+Enter newline · Paste screenshot (Ctrl/Cmd+V) to analyze with Grok vision
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="pl-public-xchat-demo__footer">
        <span className="text-xs text-[var(--xf-text-400)]">Recorded UI replay — sign in for live xChat</span>
        <button
          className="text-xs font-semibold text-[var(--xf-gain-green)] underline-offset-2 hover:underline"
          type="button"
          onClick={onReplay}
        >
          Replay
        </button>
      </div>
    </div>
  );
}
