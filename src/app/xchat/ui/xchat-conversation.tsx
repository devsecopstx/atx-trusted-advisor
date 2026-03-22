"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { XchatMarkdownBody } from "@/app/xchat/ui/xchat-markdown-body";

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

type XchatConversationProps = {
  /** Published default persona name for this session’s role (Super-Agent vs xFinance). */
  defaultPublishedPersonaName: string;
};

const ATXFINANCE_COLLECTION_ID_FALLBACK = "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236";

const THIRTY_DAY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type VisibleCollection = {
  collectionId: string;
  collectionName?: string;
  source: "atxfinance_default" | "user_history" | "assigned_persona";
};

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
  const [visibleCollections, setVisibleCollections] = useState<VisibleCollection[]>([]);
  const [, setAssociatedCollectionCount] = useState(1);
  const [collectionsStatus, setCollectionsStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const promptExamples = [
    "Show my portfolio allocation",
    "What are my top movers today",
    "Covered call ideas for my holdings",
    "Compare SPY vs QQQ trend today",
    "Stress test portfolio for volatility spike",
    "xStrategy"
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
          throw new Error(payload.error ?? `Failed to load xChat collections (${response.status})`);
        }
        if (!active) {
          return;
        }
        setVisibleCollections(payload.data ?? []);
        setActivePersonaName(payload.metadata?.activePersonaName ?? defaultPublishedPersonaName);
        setAssociatedCollectionCount(
          Number.isInteger(payload.metadata?.associatedCollectionCount)
            ? (payload.metadata?.associatedCollectionCount ?? 1)
            : (payload.data ?? []).length || 1
        );
      } catch (error) {
        if (!active) {
          return;
        }
        setCollectionsStatus(error instanceof Error ? error.message : "Failed to load visible collections");
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
          fetch("/api/xchat/history?limit=30"),
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
        const filteredRecentHistory = (historyPayload.data?.items ?? []).filter((item) => {
          const createdAtMs = new Date(item.createdAt).getTime();
          return Number.isFinite(createdAtMs) && nowMs - createdAtMs <= THIRTY_DAY_WINDOW_MS;
        });
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

    setMessages((prev) => [...prev, userMsg]);
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
        data?: { response: string; personaName?: string };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "error",
            content: payload.error ?? `Request failed (${response.status})`,
            timestamp: Date.now()
          }
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          content: payload.data?.response ?? "",
            persona: payload.data?.personaName ?? activePersonaName,
          timestamp: Date.now()
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "error",
          content: "Network error. Check your connection.",
          timestamp: Date.now()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="xchat-main">
      <div className="xchat-persona-bar">
        <span className="status-badge status-ready">Published default</span>
        <span className="status-text" style={{ fontSize: "0.8rem" }}>
          USER_STATS
        </span>
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          Collection list loaded for ask:{" "}
          {visibleCollections.length > 0
            ? visibleCollections.map((entry) => entry.collectionName ?? entry.collectionId).join(", ")
            : ATXFINANCE_COLLECTION_ID_FALLBACK}
        </span>
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
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hit me – portfolio questions, optimizations, whatever"
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
                Last 30 days of saved prompts (lazy-loaded on first expand).
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
