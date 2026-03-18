"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type PersonaOption = {
  _id?: string;
  name: string;
  model: string;
  defaultScope: string;
  enableRag: boolean;
};

type Message = {
  id: string;
  role: "user" | "ai" | "error";
  content: string;
  persona?: string;
  timestamp: number;
};

export function XchatConversation() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [personaStatus, setPersonaStatus] = useState("Loading personas...");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadPersonas = useCallback(async () => {
    try {
      const response = await fetch("/api/personas");
      if (!response.ok) {
        setPersonaStatus("Failed to load personas");
        return;
      }
      const payload = (await response.json()) as { data: PersonaOption[] };
      setPersonas(payload.data);
      if (payload.data.length > 0 && !selectedPersonaId) {
        setSelectedPersonaId(payload.data[0]._id ?? "");
      }
      setPersonaStatus(`${payload.data.length} persona${payload.data.length === 1 ? "" : "s"} available`);
    } catch {
      setPersonaStatus("Failed to load personas");
    }
  }, [selectedPersonaId]);

  useEffect(() => {
    void loadPersonas();
  }, [loadPersonas]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedPersona = personas.find((p) => p._id === selectedPersonaId);

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
          scope: selectedPersona?.defaultScope ?? "global",
          personaId: selectedPersonaId || undefined
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: { response: string };
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
          persona: selectedPersona?.name,
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
        <select
          onChange={(e) => setSelectedPersonaId(e.target.value)}
          value={selectedPersonaId}
        >
          {personas.map((persona) => (
            <option key={persona._id ?? persona.name} value={persona._id ?? ""}>
              {persona.name} ({persona.model})
            </option>
          ))}
        </select>
        {selectedPersona ? (
          <span className="status-badge status-ready">
            {selectedPersona.defaultScope}
          </span>
        ) : null}
        <span className="status-text" style={{ fontSize: "0.75rem" }}>
          {personaStatus}
        </span>
      </div>

      <div className="xchat-messages">
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <p className="status-text">
              Start a conversation with{" "}
              {selectedPersona ? selectedPersona.name : "xChat"}.
            </p>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            className={`xchat-msg xchat-msg-${msg.role}`}
            key={msg.id}
          >
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
