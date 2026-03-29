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

/** `parseXaiResponseJson` prefers `response.text()`; plain objects without `text` can break undici-style mocks. */
function xaiResponsesOk(body: Record<string, unknown>) {
  const json = JSON.stringify(body);
  return {
    ok: true,
    status: 200,
    text: async () => json,
    json: async () => JSON.parse(json) as Record<string, unknown>
  };
}

describe("respondWithXaiToolLoop", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns text directly when model does not call tools", async () => {
    fetchMock.mockResolvedValueOnce(
      xaiResponsesOk({
        model: "grok-4-1-fast",
        output_text: "The answer is 42."
      })
    );

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
    const [, init0] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body0 = JSON.parse(String(init0.body)) as Record<string, unknown>;
    expect(body0.instructions).toBe("You are a test agent.");
    expect(body0).not.toHaveProperty("system_prompt");
  });

  it("uses instructions only on first /responses turn; continuation sends previous_response_id without instructions", async () => {
    fetchMock
      .mockResolvedValueOnce(
        xaiResponsesOk({
          id: "resp_first",
          model: "grok-4-1-fast",
          output_text: '{"operation":"portfolio_summary"}'
        })
      )
      .mockResolvedValueOnce(
        xaiResponsesOk({
          model: "grok-4-1-fast",
          output_text: "Summary ready."
        })
      );

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    await respondWithXaiToolLoop({
      systemPrompt: "SYS",
      userPrompt: "Go",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      maxTurns: 5,
      executor: async () => ({ result: "{}" })
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init0] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body0 = JSON.parse(String(init0.body)) as Record<string, unknown>;
    expect(body0.instructions).toBe("SYS");
    expect(body0.previous_response_id).toBeUndefined();
    const [, init1] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body1 = JSON.parse(String(init1.body)) as Record<string, unknown>;
    expect(body1.previous_response_id).toBe("resp_first");
    expect(body1).not.toHaveProperty("instructions");
    expect(body1).not.toHaveProperty("system_prompt");
  });

  it("starts from previous response id and enables store_messages when requested", async () => {
    fetchMock.mockResolvedValueOnce(
      xaiResponsesOk({
        id: "resp_next_1",
        model: "grok-4-1-fast",
        output_text: "Remote continuation reply."
      })
    );

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "SYS",
      userPrompt: "Continue",
      tools: [{ type: "web_search" }],
      executor: async () => ({ result: "{}" }),
      previousResponseId: "resp_prev_1",
      storeMessages: true
    });

    expect(result.responseId).toBe("resp_next_1");
    const [, init0] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body0 = JSON.parse(String(init0.body)) as Record<string, unknown>;
    expect(body0.previous_response_id).toBe("resp_prev_1");
    expect(body0).not.toHaveProperty("instructions");
    expect(body0.store_messages).toBe(true);
  });

  it("runs atxfinance executor when model prints fenced JSON instead of function_call", async () => {
    fetchMock.mockResolvedValueOnce(
      xaiResponsesOk({
        model: "grok-4-1-fast",
        output_text:
          '```json\n{\n  "tool": "atxfinance",\n  "operation": "portfolio_summary"\n}\n```'
      })
    );

    fetchMock.mockResolvedValueOnce(
      xaiResponsesOk({
        model: "grok-4-1-fast",
        output_text: "Here is your portfolio overview."
      })
    );

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

  it("retries with previous_response_id when model prints xai-tool web_search markup", async () => {
    const markup = `<xai-tool call="web_search">
{"query": "SpaceX suppliers stocks", "num_results": 20}
</xai-tool call>`;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xml_ws_1",
        model: "grok-4-1-fast",
        output_text: markup
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xml_ws_2",
        model: "grok-4-1-fast",
        output_text: "Here are suppliers often cited in supply-chain coverage."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Find SpaceX supplier stocks",
      tools: [{ type: "web_search" }],
      maxTurns: 5,
      executor: async () => ({ result: "should not run for hosted web_search" })
    });

    expect(result.outputText).toBe("Here are suppliers often cited in supply-chain coverage.");
    expect(result.toolCalls.some((c) => c.name === "web_search")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      previous_response_id?: string;
      input?: string;
    };
    expect(secondBody.previous_response_id).toBe("resp_xml_ws_1");
    expect(typeof secondBody.input).toBe("string");
    expect(secondBody.input).toContain("web_search");
    expect(secondBody.input).toContain("SpaceX suppliers stocks");
  });

  it("retries when model prints bare JSON name/arguments web_search object", async () => {
    const payload =
      '{"name": "web_search", "arguments": {"query": "current weather in Austin TX today"}}';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_ws_json_tool_1",
        model: "grok-4-1-fast",
        output_text: payload
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_ws_json_tool_2",
        model: "grok-4-1-fast",
        output_text: "Warm and sunny in Austin today."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Weather?",
      tools: [{ type: "web_search" }],
      maxTurns: 5,
      executor: async () => ({ result: "should not run for hosted web_search" })
    });

    expect(result.outputText).toBe("Warm and sunny in Austin today.");
    expect(result.toolCalls.some((c) => c.name === "web_search")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      previous_response_id?: string;
      input?: string;
    };
    expect(secondBody.previous_response_id).toBe("resp_ws_json_tool_1");
    expect(String(secondBody.input)).toContain("current weather in Austin TX today");
  });

  it("retries when bare web_search JSON is embedded after prose", async () => {
    const output =
      'I will search for you.\n{"name": "web_search", "arguments": {"query": "Austin TX weather"}}';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_ws_json_embed_1",
        model: "grok-4-1-fast",
        output_text: output
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_ws_json_embed_2",
        model: "grok-4-1-fast",
        output_text: "Done."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Weather?",
      tools: [{ type: "web_search" }],
      maxTurns: 5,
      executor: async () => ({ result: "unused" })
    });

    expect(result.outputText).toBe("Done.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as { input?: string };
    expect(String(secondBody.input)).toContain("Austin TX weather");
  });

  it("retries when model prints xai-tool with name=web_search on the tag", async () => {
    const markup = `<xai-tool name="web_search">
{"query": "current weather in Austin TX today"}
</xai-tool>`;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xai_tool_name_attr_1",
        model: "grok-4-1-fast",
        output_text: markup
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xai_tool_name_attr_2",
        model: "grok-4-1-fast",
        output_text: "Austin is warm today."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Weather in Austin?",
      tools: [{ type: "web_search" }],
      maxTurns: 5,
      executor: async () => ({ result: "should not run for hosted web_search" })
    });

    expect(result.outputText).toBe("Austin is warm today.");
    expect(result.toolCalls.some((c) => c.name === "web_search")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      previous_response_id?: string;
      input?: string;
    };
    expect(secondBody.previous_response_id).toBe("resp_xai_tool_name_attr_1");
    expect(typeof secondBody.input).toBe("string");
    expect(secondBody.input).toContain("current weather in Austin TX today");
  });

  it("retries when model prints xai-tool with name/params JSON (no call= attribute)", async () => {
    const markup = `<xai-tool>
{"name": "web_search", "params": {"query": "current weather in Austin TX today"}}
</xai-tool>`;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xai_tool_name_params_1",
        model: "grok-4-1-fast",
        output_text: markup
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xai_tool_name_params_2",
        model: "grok-4-1-fast",
        output_text: "Austin is warm and partly cloudy today."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Weather in Austin?",
      tools: [{ type: "web_search" }],
      maxTurns: 5,
      executor: async () => ({ result: "should not run for hosted web_search" })
    });

    expect(result.outputText).toBe("Austin is warm and partly cloudy today.");
    expect(result.toolCalls.some((c) => c.name === "web_search")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      previous_response_id?: string;
      input?: string;
    };
    expect(secondBody.previous_response_id).toBe("resp_xai_tool_name_params_1");
    expect(secondBody.input).toContain("current weather in Austin TX today");
  });

  it("runs atxfinance for every XML function_call when KB-style emits multiple blocks in one turn", async () => {
    const xml = `atx-trusted-advisor
<function_call name="atxfinance">
<argument name="operation">portfolio_summary</argument>
</function_call>
<function_call name="atxfinance">
<argument name="operation">positions_snapshot</argument>
</function_call>`;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_multi_xml_1",
        model: "grok-4-1-fast",
        output_text: xml
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_multi_xml_2",
        model: "grok-4-1-fast",
        output_text: "Here is your allocation and open positions."
      })
    });

    const ops: string[] = [];
    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Show my portfolio allocation",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      maxTurns: 3,
      executor: async (name, args) => {
        expect(name).toBe("atxfinance");
        const op = (args as { operation?: string }).operation;
        expect(op).toMatch(/portfolio_summary|positions_snapshot/);
        ops.push(op ?? "");
        return { result: JSON.stringify({ ok: op }) };
      }
    });

    expect(ops).toEqual(["portfolio_summary", "positions_snapshot"]);
    expect(result.outputText).toBe("Here is your allocation and open positions.");
    expect(result.toolCalls.filter((c) => c.name === "atxfinance")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      input?: Array<{ type?: string; call_id?: string }>;
    };
    expect(Array.isArray(secondBody.input)).toBe(true);
    expect(secondBody.input?.filter((x) => x.type === "function_call_output")).toHaveLength(2);
  });

  it("recovers XML pseudo tool calls when maxTurns is 1 (extends loop for one follow-up)", async () => {
    const xml =
      '<function_call name="atxfinance">\n<argument name="operation">portfolio_summary</argument>\n</function_call>';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xml_low_turns_1",
        model: "grok-4-1-fast",
        output_text: xml
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_xml_low_turns_2",
        model: "grok-4-1-fast",
        output_text: "Summary only — no raw XML in the final reply."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Portfolio",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      maxTurns: 1,
      executor: async (name, args) => {
        expect(name).toBe("atxfinance");
        expect(args).toEqual({ operation: "portfolio_summary" });
        return { result: "{}" };
      }
    });

    expect(result.outputText).toBe("Summary only — no raw XML in the final reply.");
    expect(result.toolCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("runs atxfinance executor when model prints JSON inside function_call (watchlist_add_symbols)", async () => {
    const xml = `<function_call name="atxfinance">
{"operation":"watchlist_add_symbols","symbols":["NVDA"]}
</function_call>`;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_fc_json_watchlist_1",
        model: "grok-4-1-fast",
        output_text: xml
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_fc_json_watchlist_2",
        model: "grok-4-1-fast",
        output_text: "Added NVDA to your watchlist."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Add NVDA",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      maxTurns: 5,
      executor: async (name, args) => {
        expect(name).toBe("atxfinance");
        expect(args).toEqual({
          operation: "watchlist_add_symbols",
          symbols: ["NVDA"]
        });
        return { result: JSON.stringify({ ok: true }) };
      }
    });

    expect(result.outputText).toBe("Added NVDA to your watchlist.");
    expect(result.toolCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("runs atxfinance executor for XML function_call with positions_snapshot", async () => {
    const xml =
      '<function_call name="atxfinance">\n<argument name="operation">positions_snapshot</argument>\n</function_call>';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: xml
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "grok-4-1-fast",
        output_text: "Here are your positions."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Show my positions",
      tools: [{ type: "function", function: { name: "atxfinance", parameters: {} } }],
      maxTurns: 5,
      executor: async (name, args) => {
        expect(name).toBe("atxfinance");
        expect(args).toEqual({ operation: "positions_snapshot" });
        return { result: "{}" };
      }
    });

    expect(result.outputText).toBe("Here are your positions.");
    expect(result.toolCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("acks hosted web_search function_call without calling executor", async () => {
    const executor = vi.fn(async () => ({ result: "should-not-run" }));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_ws_hosted_1",
        model: "grok-4-1-fast",
        output: [
          {
            type: "function_call",
            call_id: "call_ws",
            name: "web_search",
            arguments: JSON.stringify({ query: "xAI news" })
          }
        ]
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_ws_hosted_2",
        model: "grok-4-1-fast",
        output_text: "Latest xAI updates summarized."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "News?",
      tools: [{ type: "web_search" }],
      maxTurns: 5,
      executor
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.toolCalls[0]?.name).toBe("web_search");
    expect(result.toolCalls[0]?.result).toBe("{}");
    expect(result.outputText).toBe("Latest xAI updates summarized.");
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      previous_response_id?: string;
      input?: unknown;
    };
    expect(secondBody.previous_response_id).toBe("resp_ws_hosted_1");
  });

  it("acks hosted file_search function_call without calling executor", async () => {
    const executor = vi.fn(async () => ({ result: "should-not-run" }));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_fs_hosted_1",
        model: "grok-4-1-fast",
        output: [
          {
            type: "function_call",
            call_id: "call_fs",
            name: "file_search",
            arguments: JSON.stringify({ vector_store_ids: ["collection_team_default"], query: "TSLA" })
          }
        ]
      })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "resp_fs_hosted_2",
        model: "grok-4-1-fast",
        output_text: "Collection hits summarized."
      })
    });

    const { respondWithXaiToolLoop } = await import("@/lib/xai");
    const result = await respondWithXaiToolLoop({
      systemPrompt: "Test",
      userPrompt: "Search collection for TSLA",
      tools: [{ type: "file_search", vector_store_ids: ["collection_team_default"] }],
      maxTurns: 5,
      executor
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.toolCalls[0]?.name).toBe("file_search");
    expect(result.toolCalls[0]?.result).toBe("{}");
    expect(result.outputText).toBe("Collection hits summarized.");
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      previous_response_id?: string;
    };
    expect(secondBody.previous_response_id).toBe("resp_fs_hosted_1");
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
