"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";
import { ATXFINANCE_COLLECTION_ID } from "@/modules/xchat/types";

type Message = {
  id: string;
  role: "user" | "ai" | "error";
  content: string;
  persona?: string;
  timestamp: number;
};

type HistoryItem = {
  id: string;
  message: string;
  response: string;
  model: string;
  createdAt: string;
  personaId?: string;
  contextReferenceCount: number;
  toolCallCount: number;
};

type HistoryStats = {
  totalPrompts: number;
  activeDays: number;
  referencedFileCount: number;
  lastPromptAt?: string;
};

type AskToolCallSummary = {
  name: string;
  durationMs: number;
};

function formatLastTurnToolSummary(calls: AskToolCallSummary[] | undefined): string {
  if (!calls || calls.length === 0) {
    return "No tools invoked this turn";
  }
  const totalMs = calls.reduce((sum, c) => sum + c.durationMs, 0);
  const uniqNames = [...new Set(calls.map((c) => c.name))];
  return `${calls.length} call${calls.length === 1 ? "" : "s"} · ${totalMs}ms · ${uniqNames.join(", ")}`;
}

type XchatConversationProps = {
  /** Published default persona name for this session’s role (Super-Agent vs xFinance). */
  defaultPublishedPersonaName: string;
};

const THIRTY_DAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Saved chat history panel: last N prompts from `/api/xchat/history` (newest first). */
const CHAT_HISTORY_PROMPT_LIMIT = 10;

/** In-memory transcript: cap turns so the thread stays bounded during long sessions. */
const MAX_TRANSCRIPT_MESSAGES = CHAT_HISTORY_PROMPT_LIMIT * 2;

function trimTranscript(msgs: Message[]): Message[] {
  if (msgs.length <= MAX_TRANSCRIPT_MESSAGES) {
    return msgs;
  }
  return msgs.slice(-MAX_TRANSCRIPT_MESSAGES);
}

type VisibleCollection = {
  collectionId: string;
  collectionName?: string;
  source: "atxfinance_default" | "user_history" | "assigned_persona";
};

/** Mirrors `GET /api/xchat/collections` default row when the API is missing (404) or unreachable. */
const DEFAULT_VISIBLE_COLLECTIONS: VisibleCollection[] = [
  {
    collectionId: ATXFINANCE_COLLECTION_ID,
    collectionName: "aTxFinance Default",
    source: "atxfinance_default"
  }
];

export function XchatConversation({ defaultPublishedPersonaName }: XchatConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedHistory, setSavedHistory] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [exampleExpanded, setExampleExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePersonaName, setActivePersonaName] = useState(defaultPublishedPersonaName);
  const [lastTurnToolSummary, setLastTurnToolSummary] = useState<string | null>(null);
  const [visibleCollections, setVisibleCollections] = useState<VisibleCollection[]>([]);
  const [, setAssociatedCollectionCount] = useState(1);
  const [collectionsStatus, setCollectionsStatus] = useState<string | null>(null);
  const [collectionsScopeDegraded, setCollectionsScopeDegraded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const promptExamples = [
    "Show my portfolio allocation",
    "What are my top movers today",
    "Covered call ideas for my holdings",
    "Compare SPY vs QQQ trend today",
    "Stress test portfolio for volatility spike",
    "xStrategy",
    "How's the weather today in Austin, TX"
  ] as const;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let active = true;
    async function loadVisibleCollections() {
      try {
        const response = await fetch("/api/xchat/collections");
        const payload = (await response.json().catch(() => ({}))) as {
          data?: VisibleCollection[];
          metadata?: { activePersonaName?: string; associatedCollectionCount?: number };
          error?: string;
        };
        if (!response.ok) {
          if (!active) {
            return;
          }
          setVisibleCollections(DEFAULT_VISIBLE_COLLECTIONS);
          setAssociatedCollectionCount(1);
          setActivePersonaName(defaultPublishedPersonaName);
          setCollectionsScopeDegraded(true);
          setCollectionsStatus(null);
          return;
        }
        if (!active) {
          return;
        }
        setCollectionsScopeDegraded(false);
        setVisibleCollections(payload.data ?? []);
        setActivePersonaName(payload.metadata?.activePersonaName ?? defaultPublishedPersonaName);
        setAssociatedCollectionCount(
          Number.isInteger(payload.metadata?.associatedCollectionCount)
            ? (payload.metadata?.associatedCollectionCount ?? 1)
            : (payload.data ?? []).length || 1
        );
        setCollectionsStatus(null);
      } catch {
        if (!active) {
          return;
        }
        setVisibleCollections(DEFAULT_VISIBLE_COLLECTIONS);
        setAssociatedCollectionCount(1);
        setActivePersonaName(defaultPublishedPersonaName);
        setCollectionsScopeDegraded(true);
        setCollectionsStatus(null);
      }
    }
    void loadVisibleCollections();
    return () => {
      active = false;
    };
  }, [defaultPublishedPersonaName]);

  useEffect(() => {
    if (!historyExpanded || historyLoaded) {
      return;
    }
    let active = true;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const [historyRes, statsRes] = await Promise.all([
          fetch(`/api/xchat/history?limit=${CHAT_HISTORY_PROMPT_LIMIT}`),
          fetch("/api/xchat/history/stats")
        ]);
        const historyPayload = (await historyRes.json().catch(() => ({}))) as {
          data?: { items?: HistoryItem[] };
          error?: string;
        };
        const statsPayload = (await statsRes.json().catch(() => ({}))) as {
          data?: HistoryStats;
          error?: string;
        };

        if (!historyRes.ok || !statsRes.ok) {
          throw new Error(
            historyPayload.error ??
              statsPayload.error ??
              `History request failed (${historyRes.status}/${statsRes.status})`
          );
        }

        if (!active) {
          return;
        }
        const nowMs = Date.now();
        const filteredRecentHistory = (historyPayload.data?.items ?? [])
          .filter((item) => {
            const createdAtMs = new Date(item.createdAt).getTime();
            return Number.isFinite(createdAtMs) && nowMs - createdAtMs <= THIRTY_DAY_WINDOW_MS;
          })
          .slice(0, CHAT_HISTORY_PROMPT_LIMIT);
        setSavedHistory(filteredRecentHistory);
        setHistoryStats(statsPayload.data ?? null);
        setHistoryLoaded(true);
      } catch (error) {
        if (!active) {
          return;
        }
        setHistoryError(error instanceof Error ? error.message : "Failed to load history");
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [historyExpanded, historyLoaded]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now()
    };

    setMessages((prev) => trimTranscript([...prev, userMsg]));
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          scope: "global"
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          response: string;
          personaName?: string;
          toolCalls?: AskToolCallSummary[];
        };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setMessages((prev) =>
          trimTranscript([
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "error",
              content: payload.error ?? `Request failed (${response.status})`,
              timestamp: Date.now()
            }
          ])
        );
        return;
      }

      const resolvedName = payload.data?.personaName ?? activePersonaName;
      setActivePersonaName(resolvedName);
      setLastTurnToolSummary(formatLastTurnToolSummary(payload.data?.toolCalls));

      setMessages((prev) =>
        trimTranscript([
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: payload.data?.response ?? "",
            persona: resolvedName,
            timestamp: Date.now()
          }
        ])
      );
    } catch {
      setMessages((prev) =>
        trimTranscript([
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "error",
            content: "Network error. Check your connection.",
            timestamp: Date.now()
          }
        ])
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="xchat-main">
      <div className="xchat-persona-bar">
        <span className="status-badge status-ready">Published default</span>
        <span
          className="status-text xchat-last-turn-tools"
          style={{ fontSize: "0.8rem" }}
          title={lastTurnToolSummary ?? "Tool names and durations from the last completed ask"}
        >
          <strong>{activePersonaName}</strong>
          {lastTurnToolSummary ? (
            <>
              {" "}
              | {lastTurnToolSummary}
            </>
          ) : (
            <span style={{ opacity: 0.75 }}> | Send a message to see tool stats</span>
          )}
        </span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          Collection list loaded for ask:{" "}
          {visibleCollections.length > 0
            ? visibleCollections.map((entry) => entry.collectionName ?? entry.collectionId).join(", ")
            : ATXFINANCE_COLLECTION_ID}
        </span>
        {collectionsScopeDegraded ? (
          <span className="status-text status-warn" style={{ fontSize: "0.75rem" }}>
            Default Finance scope only — server collection list unavailable (404 or network).
          </span>
        ) : null}
        {collectionsStatus ? <span className="status-text status-error">{collectionsStatus}</span> : null}
      </div>

      <div className="xchat-messages">
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <p className="status-text">
              Start a conversation with the published default <strong>{activePersonaName}</strong>.
            </p>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div className={`xchat-msg xchat-msg-${msg.role}`} key={msg.id}>
            {msg.role === "ai" && msg.persona ? (
              <small style={{ color: "var(--xf-text-400)", display: "block", marginBottom: "0.3rem" }}>
                {msg.persona}
              </small>
            ) : null}
            {msg.role === "ai" ? (
              <XchatMarkdownBody content={msg.content} />
            ) : (
              <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
            )}
          </div>
        ))}

        {loading ? (
          <div className="xchat-typing">
            <span className="xchat-typing-dot" />
            <span className="xchat-typing-dot" />
            <span className="xchat-typing-dot" />
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <form className="xchat-input-bar" onSubmit={handleSend}>
        <input
          aria-busy={loading}
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            loading
              ? "Thinking..."
              : "Hit me – portfolio questions, optimizations, whatever"
          }
          readOnly={loading}
          value={input}
        />
        <button disabled={loading || !input.trim()} type="submit">
          Send
        </button>
      </form>

      <section className="xchat-below-input-panels">
        <article className="xchat-collapsible-panel">
          <button
            aria-expanded={exampleExpanded}
            className="xchat-panel-toggle"
            onClick={() => setExampleExpanded((prev) => !prev)}
            type="button"
          >
            <span className="status-badge status-ready">Example prompts</span>
            <span className="status-text">{exampleExpanded ? "Collapse" : "Expand"}</span>
          </button>
          {exampleExpanded ? (
            <div className="xchat-panel-body">
              <p className="status-text xchat-panel-hint">
                Finance-focused examples for quick starts. Click one to copy into the input.
              </p>
              <div className="xchat-example-grid">
                {promptExamples.map((prompt) => (
                  <button
                    className="xchat-example-chip"
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="xchat-collapsible-panel">
          <button
            aria-expanded={historyExpanded}
            className="xchat-panel-toggle"
            onClick={() => setHistoryExpanded((prev) => !prev)}
            type="button"
          >
            <span className="status-badge status-ready">Chat history</span>
            <span className="status-text">{historyExpanded ? "Collapse" : "Expand"}</span>
          </button>
          {historyExpanded ? (
            <div className="xchat-panel-body">
              <p className="status-text xchat-panel-hint">
                Last {CHAT_HISTORY_PROMPT_LIMIT} prompts in the last 30 days (lazy-loaded on first expand).
              </p>
              <div className="xchat-history-stats">
                <span className="chip">Prompts: {historyStats?.totalPrompts ?? 0}</span>
                <span className="chip">Active days: {historyStats?.activeDays ?? 0}</span>
                <span className="chip">
                  Collection files seen: {historyStats?.referencedFileCount ?? 0}
                </span>
              </div>
              {historyLoading ? <p className="status-text">Loading history...</p> : null}
              {historyError ? <p className="status-text status-error">{historyError}</p> : null}
              {!historyLoading && !historyError && savedHistory.length === 0 ? (
                <p className="status-text">No recent history yet in the last 30 days.</p>
              ) : null}
              {!historyLoading && !historyError && savedHistory.length > 0 ? (
                <ul className="xchat-history-list">
                  {savedHistory.map((item) => (
                    <li className="xchat-history-item" key={item.id}>
                      <div className="xchat-history-item-head">
                        <strong>{new Date(item.createdAt).toLocaleString()}</strong>
                        <span>{item.model}</span>
                      </div>
                      <p className="xchat-history-item-prompt">{item.message}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
