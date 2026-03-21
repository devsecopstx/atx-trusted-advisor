"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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
  collectionId?: string | null;
};

type XchatConversationProps = {
  /** Published default persona name for this session’s role (Super-Agent vs xFinance). */
  defaultPublishedPersonaName: string;
};

export function XchatConversation({ defaultPublishedPersonaName }: XchatConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedHistory, setSavedHistory] = useState<HistoryItem[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const [historyRes, statsRes] = await Promise.all([
          fetch("/api/xchat/history?limit=12"),
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
        setSavedHistory(historyPayload.data?.items ?? []);
        setHistoryStats(statsPayload.data ?? null);
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
  }, []);

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
          persona: payload.data?.personaName ?? defaultPublishedPersonaName,
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
          xChat uses <strong>{defaultPublishedPersonaName}</strong> for your role (Super-Agent for admins,
          xFinance for members). No persona picker — both should stay published in Admin → Personas.
        </span>
      </div>

      <section className="xchat-history-panel">
        <div className="xchat-history-panel-header">
          <div>
            <p className="status-badge status-ready">Saved history (beta)</p>
            <p className="status-text xchat-history-subtext">
              Past sessions are API-first. Current session prompts stay in the live thread below.
            </p>
          </div>
          <div className="xchat-history-actions">
            <button className="tiny-button" type="button">
              TODO: Service link
            </button>
            <button className="tiny-button" type="button">
              TODO: Share
            </button>
            <button className="tiny-button" type="button">
              TODO: History tools
            </button>
          </div>
        </div>

        <div className="xchat-history-stats">
          <span className="chip">Prompts: {historyStats?.totalPrompts ?? 0}</span>
          <span className="chip">Active days: {historyStats?.activeDays ?? 0}</span>
          <span className="chip">Collection files seen: {historyStats?.referencedFileCount ?? 0}</span>
          <span className="chip">
            Collection ID: {historyStats?.collectionId?.slice(0, 22) ?? "not-linked"}
          </span>
        </div>

        {historyLoading ? <p className="status-text">Loading past-session history...</p> : null}
        {historyError ? <p className="status-text status-error">{historyError}</p> : null}
        {!historyLoading && !historyError && savedHistory.length === 0 ? (
          <p className="status-text">No saved history yet. Ask your first prompt below.</p>
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
      </section>

      <div className="xchat-messages">
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <p className="status-text">
              Start a conversation with the published default <strong>{defaultPublishedPersonaName}</strong>.
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
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
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
    </div>
  );
}
