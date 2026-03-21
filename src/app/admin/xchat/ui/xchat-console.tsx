"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";

import { AskIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";
import { XPERSONA_SUPER_AGENT_NAME } from "@/modules/xchat/default-xpersonas";

export type AdminXchatPersonaOption = {
  _id?: string;
  name: string;
  model: string;
  defaultScope: string;
};

type AskResponse = {
  data: {
    response: string;
  };
};

function resolveSuperAgentPersonaId(personas: AdminXchatPersonaOption[]): string {
  const key = XPERSONA_SUPER_AGENT_NAME.trim().toLowerCase();
  for (const p of personas) {
    const id = typeof p._id === "string" ? p._id.trim() : "";
    if (id && p.name.trim().toLowerCase() === key) {
      return id;
    }
  }
  return "";
}

type XchatConsoleProps = {
  initialPersonas: AdminXchatPersonaOption[];
};

export function XchatConsole({ initialPersonas }: XchatConsoleProps) {
  const [personas, setPersonas] = useState<AdminXchatPersonaOption[]>(initialPersonas);
  const [selectedPersona, setSelectedPersona] = useState(
    () => resolveSuperAgentPersonaId(initialPersonas) || ""
  );
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(
    initialPersonas.length > 0
      ? "Personas synced — refresh for latest from API"
      : "No personas in DB — run seed or create in Admin → Personas"
  );
  const [chatResponse, setChatResponse] = useState("");

  const personaOptions = useMemo(
    () => [
      {
        _id: "",
        name: "Server default (omit personaId — Super-Agent for global_admin)",
        model: "",
        defaultScope: "global"
      },
      ...personas
    ],
    [personas]
  );

  const refreshPersonas = useCallback(async () => {
    setStatus("Loading personas...");
    try {
      const payload = await parseJson<{ data: AdminXchatPersonaOption[] }>(await fetch("/api/personas"));
      setPersonas(payload.data);
      setSelectedPersona((prev) => {
        if (prev && payload.data.some((p) => String(p._id ?? "").trim() === prev)) {
          return prev;
        }
        return resolveSuperAgentPersonaId(payload.data) || "";
      });
      setStatus("Personas synced");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load personas");
    }
  }, []);

  async function askXchat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Asking xchat...");
    try {
      const payload = await parseJson<AskResponse>(
        await fetch("/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            personaId: selectedPersona || undefined,
            scope: "global"
          })
        })
      );
      setChatResponse(payload.data.response);
      setStatus("xchat response ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "xchat request failed");
    }
  }

  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <button className="cta cta-secondary" onClick={() => void refreshPersonas()} type="button">
          <RefreshIcon className="crud-icon" /> Refresh personas
        </button>
        <p className="status-text">{status}</p>
      </div>

      <article className="surface-card xf-widget section-card">
        <h3>Ask xchat</h3>
        <form className="stack-form" onSubmit={askXchat}>
          <select
            onChange={(event) => setSelectedPersona(event.target.value)}
            value={selectedPersona}
          >
            {personaOptions.map((persona) => (
              <option key={persona._id ?? "default"} value={persona._id ?? ""}>
                {persona.name}
              </option>
            ))}
          </select>
          <textarea
            name="message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask xchat..."
            required
            rows={4}
            value={message}
          />
          <button className="cta cta-primary" type="submit">
            <AskIcon className="crud-icon" /> Ask xchat
          </button>
        </form>
        {chatResponse ? <pre className="chat-response">{chatResponse}</pre> : null}
      </article>
    </section>
  );
}
