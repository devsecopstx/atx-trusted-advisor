"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";

import { AskIcon, RefreshIcon } from "@/app/admin/ui/crud-icons";
import { parseJson } from "@/app/admin/ui/http";

type PersonaOption = {
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

export function XchatConsole() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersona, setSelectedPersona] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Ready - refresh personas first");
  const [chatResponse, setChatResponse] = useState("");

  const personaOptions = useMemo(
    () => [{ _id: "", name: "Default xchat", model: "", defaultScope: "global" }, ...personas],
    [personas]
  );

  const refreshPersonas = useCallback(async () => {
    setStatus("Loading personas...");
    try {
      const payload = await parseJson<{ data: PersonaOption[] }>(await fetch("/api/personas"));
      setPersonas(payload.data);
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
