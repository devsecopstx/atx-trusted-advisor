"use client";

import { useEffect, useMemo, useState } from "react";

type AskSuccessPayload = {
  data: {
    response: string;
    model: string;
    personaName: string;
    toolCalls?: Array<{ name: string; durationMs: number }>;
  };
};

type TestCase = {
  id: string;
  title: string;
  category: string;
  prompt: string;
  personaMode: "optional" | "forced_code_interpreter_persona";
};

const TEST_CASES: TestCase[] = [
  {
    id: "code-interpreter-sharpe",
    title: "Sharpe ratio with code interpreter",
    category: "Portfolio optimization, risk calculations, option pricing",
    prompt:
      "Calculate the Sharpe ratio for a portfolio with returns [0.12, 0.08, -0.03, 0.15] and risk-free rate 0.02",
    personaMode: "optional"
  },
  {
    id: "code-interpreter-sharpe-forced-persona",
    title: "Sharpe ratio (forced code-interpreter persona)",
    category: "Portfolio optimization, risk calculations, option pricing",
    prompt:
      "Calculate the Sharpe ratio for a portfolio with returns [0.12, 0.08, -0.03, 0.15] and risk-free rate 0.02",
    personaMode: "forced_code_interpreter_persona"
  }
];

type PersonaSummary = {
  _id?: string | null;
  name?: string;
  xapi?: {
    tools?: Array<{ type?: string }>;
  };
};

type PersonaListEnvelope = {
  data?: PersonaSummary[];
};

const DEFAULT_FORCED_PERSONA_NAME = "atx-trusted-advisor";

export default function AdminXchatApiTestPage() {
  const [personaId, setPersonaId] = useState("");
  const [forcedPersonaId, setForcedPersonaId] = useState<string | null>(null);
  const [forcedPersonaName, setForcedPersonaName] = useState<string | null>(null);
  const [personaLookupStatus, setPersonaLookupStatus] = useState("Resolving default code-interpreter persona...");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [resultJson, setResultJson] = useState("");
  const [responseText, setResponseText] = useState("");
  const [toolSummary, setToolSummary] = useState("");

  const activeTest = useMemo(
    () => TEST_CASES.find((entry) => entry.id === runningId) ?? null,
    [runningId]
  );

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/personas");
        const payload = (await response.json().catch(() => null)) as PersonaListEnvelope | null;
        if (!response.ok || !payload?.data) {
          throw new Error(`Failed to load personas (${response.status})`);
        }
        const codeInterpreterPersonas = payload.data.filter((persona) => {
          const tools = persona.xapi?.tools ?? [];
          return tools.some((tool) => tool.type === "code_interpreter");
        });

        const preferredPersona =
          codeInterpreterPersonas.find(
            (persona) =>
              typeof persona.name === "string" &&
              persona.name.trim().toLowerCase() === DEFAULT_FORCED_PERSONA_NAME
          ) ?? codeInterpreterPersonas[0];

        if (preferredPersona?._id) {
          setForcedPersonaId(preferredPersona._id);
          setForcedPersonaName(preferredPersona.name ?? preferredPersona._id);
          setPersonaLookupStatus(
            `Default forced persona: ${preferredPersona.name ?? preferredPersona._id}`
          );
          return;
        }
        setForcedPersonaId(null);
        setForcedPersonaName(null);
        setPersonaLookupStatus(
          "No persona with code_interpreter found. Enable code_interpreter on a persona to use the forced test."
        );
      } catch (error) {
        setForcedPersonaId(null);
        setForcedPersonaName(null);
        setPersonaLookupStatus(
          error instanceof Error ? error.message : "Failed to resolve default forced persona"
        );
      }
    })();
  }, []);

  async function runTest(testCase: TestCase) {
    setRunningId(testCase.id);
    setStatus(`Running: ${testCase.title}`);
    setResultJson("");
    setResponseText("");
    setToolSummary("");
    const startedAt = Date.now();

    try {
      const body: { message: string; personaId?: string } = {
        message: testCase.prompt
      };
      if (testCase.personaMode === "forced_code_interpreter_persona") {
        if (!forcedPersonaId) {
          throw new Error(
            "No default code-interpreter persona is configured. Add code_interpreter to at least one persona first."
          );
        }
        body.personaId = forcedPersonaId;
      } else {
        const trimmedPersonaId = personaId.trim();
        if (trimmedPersonaId.length > 0) {
          body.personaId = trimmedPersonaId;
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let response: Response;
      try {
        response = await fetch("/api/xchat/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const errorText =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? `HTTP ${response.status}`)
            : `HTTP ${response.status}`;
        throw new Error(errorText);
      }

      const typedPayload = payload as AskSuccessPayload;
      const elapsedMs = Date.now() - startedAt;
      const toolCalls = typedPayload.data.toolCalls ?? [];
      const toolLine =
        toolCalls.length === 0
          ? "No tool calls were reported."
          : toolCalls.map((tool) => `${tool.name} (${tool.durationMs}ms)`).join(", ");

      setResponseText(typedPayload.data.response ?? "");
      setResultJson(JSON.stringify(payload, null, 2));
      setToolSummary(toolLine);
      setStatus(
        `Success in ${(elapsedMs / 1000).toFixed(2)}s · model=${typedPayload.data.model} · persona=${typedPayload.data.personaName}`
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("Failed: timed out after 30s waiting for /api/xchat/ask");
      } else {
        setStatus(error instanceof Error ? `Failed: ${error.message}` : "Failed: Unknown error");
      }
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">admin_console · xChat</p>
        <h1 className="hero-title">xChat API test suite</h1>
        <p className="hero-copy">
          Developer harness for <code className="xsb-inline-code">POST /api/xchat/ask</code>. Use this page to
          verify persona tool wiring, including <code className="xsb-inline-code">code_interpreter</code>.
        </p>
      </section>

      <section className="panel stack-gap">
        <article className="surface-card xf-widget section-card stack-gap">
          <h2>Suite configuration</h2>
          <label className="status-text" htmlFor="xchat-api-test-persona-id">
            Optional persona id override (must resolve to a persona that includes code_interpreter)
          </label>
          <input
            id="xchat-api-test-persona-id"
            onChange={(event) => setPersonaId(event.target.value)}
            placeholder="persona ObjectId (optional)"
            value={personaId}
          />
          <p className="status-text">{personaLookupStatus}</p>
          {forcedPersonaId ? (
            <p className="status-text">
              Forced persona id: <code>{forcedPersonaId}</code>
              {forcedPersonaName ? ` (${forcedPersonaName})` : ""}
            </p>
          ) : null}
          <p className="status-text">{status}</p>
        </article>

        <article className="surface-card xf-widget section-card stack-gap">
          <h2>Developers and integration tests</h2>
          {TEST_CASES.map((testCase) => {
            const disabled = runningId !== null;
            const isRunning = runningId === testCase.id;
            return (
              <div
                key={testCase.id}
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 8,
                  padding: "0.8rem 0.95rem"
                }}
              >
                <p className="status-text" style={{ margin: 0 }}>
                  {testCase.category}
                </p>
                <h3 style={{ margin: "0.35rem 0 0.45rem" }}>{testCase.title}</h3>
                <pre
                  className="status-text"
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    background: "rgba(255, 255, 255, 0.03)",
                    borderRadius: 6,
                    padding: "0.65rem"
                  }}
                >
                  {testCase.prompt}
                </pre>
                <div className="tool-row" style={{ marginTop: "0.7rem" }}>
                  <button
                    className="cta cta-primary"
                    disabled={
                      disabled ||
                      (testCase.personaMode === "forced_code_interpreter_persona" && !forcedPersonaId)
                    }
                    onClick={() => void runTest(testCase)}
                    type="button"
                  >
                    {isRunning ? "Running..." : "Run test"}
                  </button>
                </div>
              </div>
            );
          })}
        </article>

        {activeTest ? null : responseText ? (
          <article className="surface-card xf-widget section-card stack-gap">
            <h2>Response preview</h2>
            <p className="status-text">{toolSummary}</p>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 8,
                padding: "0.8rem"
              }}
            >
              {responseText}
            </pre>
          </article>
        ) : null}

        {resultJson ? (
          <article className="surface-card xf-widget section-card stack-gap">
            <h2>Raw API payload</h2>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: 8,
                padding: "0.8rem"
              }}
            >
              {resultJson}
            </pre>
          </article>
        ) : null}
      </section>
    </div>
  );
}
