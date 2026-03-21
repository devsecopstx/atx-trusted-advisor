import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    XAI_API_KEY: "test-key",
    XAI_BASE_URL: "https://api.x.ai/v1",
    XAI_MANAGEMENT_API_KEY: "test-mgmt-key",
    XAI_MANAGEMENT_BASE_URL: "https://management-api.x.ai/v1",
    X_OAUTH_CLIENT_ID: "test-client-id",
    X_OAUTH_CLIENT_SECRET: "test-client-secret"
  })
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("respondWithXaiToolLoop", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns text directly when model does not call tools", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: "The answer is 42."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "You are a test agent.",
      userPrompt: "What is the answer?",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      executor: async () => ({ result: "unused" })
    });

    expect(result.outputText).toBe("The answer is 42.");
    expect(result.toolCalls).toHaveLength(0);
    expect(result.turnsUsed).toBe(1);
  });

  it("runs atxfinance executor when model prints fenced JSON instead of function_call", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text:
          '```json\n{\n  "tool": "atxfinance",\n  "operation": "portfolio_summary"\n}\n```'
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: "Here is your portfolio overview."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Show my portfolio allocation",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      maxTurns: 5,
      executor: async (name, args) => {
        expect(name).toBe("atxfinance");
        expect(args).toEqual({ operation: "portfolio_summary" });
        return { result: JSON.stringify({ name: "Default", accountCount: 1 }) };
      }
    });

    expect(result.outputText).toBe("Here is your portfolio overview.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("atxfinance");
    expect(result.turnsUsed).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("runs atxfinance executor for bare operation JSON without tool key", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: '{"operation":"portfolio_summary"}'
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: "Summary ready."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Portfolio",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      maxTurns: 5,
      executor: async (name, args) => {
        expect(name).toBe("atxfinance");
        expect(args).toEqual({ operation: "portfolio_summary" });
        return { result: "{}" };
      }
    });

    expect(result.outputText).toBe("Summary ready.");
    expect(result.toolCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("executes tool call and returns final text", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output: [
          {
            type: "function_call",
            call_id: "call_001",
            name: "atxfinance",
            arguments: JSON.stringify({ operation: "watchlist_snapshot" })
          }
        ]
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: "Your watchlist has TSLA."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "You are a test agent.",
      userPrompt: "Show my watchlist.",
      tools: [{ type: "function", function: { name: "atxfinance" } }],
      maxTurns: 5,
      executor: async (name, args) => {
        expect(name).toBe("atxfinance");
        expect(args).toEqual({ operation: "watchlist_snapshot" });
        return { result: JSON.stringify({ symbols: ["TSLA"] }) };
      }
    });

    expect(result.outputText).toBe("Your watchlist has TSLA.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("atxfinance");
    expect(result.toolCalls[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(result.turnsUsed).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caps at maxTurns and returns last output", async () => {
    for (let i = 0; i < 3; i++) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "grok-4-1-fast",
          output: [
            {
              type: "function_call",
              call_id: `call_${i}`,
              name: "atxfinance",
              arguments: "{}"
            }
          ]
        })
      });
    }

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Loop forever",
      tools: [],
      maxTurns: 3,
      executor: async () => ({ result: "ok" })
    });

    expect(result.turnsUsed).toBe(3);
    expect(result.toolCalls).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("handles executor errors gracefully", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output: [
          {
            type: "function_call",
            call_id: "call_err",
            name: "atxfinance",
            arguments: "{}"
          }
        ]
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: "I encountered an error with the tool."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Try the tool",
      tools: [],
      executor: async () => {
        throw new Error("db connection lost");
      }
    });

    expect(result.outputText).toBe("I encountered an error with the tool.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].error).toBe("db connection lost");
  });

  it("throws on xAI API error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "unauthorized" })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    await expect(
      respondWithXaiToolLoop({
        systemPrompt: "Test",
        userPrompt: "Fail",
        tools: [],
        executor: async () => ({ result: "unused" })
      })
    ).rejects.toThrow("xAI responses failed");
  });
});
