"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "ai" | "error";
  content: string;
  persona?: string;
  timestamp: number;
};

type XchatConversationProps = {
  /** Published default persona name for this session’s role (Super-Agent vs xFinance). */
  defaultPublishedPersonaName: string;
};

export function XchatConversation({ defaultPublishedPersonaName }: XchatConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
