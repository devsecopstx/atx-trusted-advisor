import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  process.env.XAI_TEAM_ID = "collection_test_super_agent";
});

import {
    createPersonaPayloadSchema,
    hasFileSearchTool
} from "@/modules/xchat/persona-validation";
import {
    ensureSuperAgentDefaultTools,
    getAdvisorDefaultTools,
    getSuperAgentDefaultTools,
    mergeXchatHostedToolBaseline,
    normalizePersonaXapiConfig,
    PERSONA_XAPI_TOOL_TYPES
} from "@/modules/xchat/types";

describe("persona tool validation", () => {
  it("normalizePersonaXapiConfig dedupes tools by type", () => {
    const result = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [
        { type: "web_search" },
        { type: "web_search" },
        { type: "x_search" },
        { type: "x_search" },
        { type: "web_search" }
      ]
    });
    expect(result.tools).toHaveLength(2);
    expect(result.tools.map((t) => t.type)).toEqual(["web_search", "x_search"]);
  });

  it("normalizePersonaXapiConfig rejects unknown tool types", () => {
    const result = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [
        { type: "web_search" },
        { type: "code_executor" as never },
        { type: "x_search" }
      ]
    });
    expect(result.tools).toHaveLength(2);
    expect(result.tools.map((t) => t.type)).toEqual(["web_search", "x_search"]);
  });

  it("normalizePersonaXapiConfig handles null/undefined input", () => {
    expect(normalizePersonaXapiConfig(null).tools).toEqual([]);
    expect(normalizePersonaXapiConfig(undefined).tools).toEqual([]);
    expect(normalizePersonaXapiConfig({}).tools).toEqual([]);
  });

  it("PERSONA_XAPI_TOOL_TYPES includes all supported tools", () => {
    expect(PERSONA_XAPI_TOOL_TYPES).toEqual([
      "web_search",
      "x_search",
      "code_interpreter",
      "file_search",
      "collections_search",
      "yahoo_finance",
      "atx_function"
    ]);
  });

  it("getSuperAgentDefaultTools uses research stack without implicit env collections_search", () => {
    const tools = getSuperAgentDefaultTools();
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.type)).toEqual([
      "atx_function",
      "yahoo_finance",
      "web_search",
      "x_search",
      "code_interpreter"
    ]);
    expect(tools.some((t) => t.type === "collections_search")).toBe(false);
  });

  it("getAdvisorDefaultTools omits file_search until persona links collections", () => {
    const tools = getAdvisorDefaultTools();
    expect(tools.map((t) => t.type)).toEqual(["atx_function", "yahoo_finance"]);
  });

  it("ensureSuperAgentDefaultTools restores advisor baseline vs super-agent baseline", () => {
    const stripped = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: []
    });
    const yahooOnly = {
      ...stripped,
      tools: [...stripped.tools, { type: "yahoo_finance" as const }]
    };
    const restoredAdvisor = ensureSuperAgentDefaultTools(yahooOnly, "advisor");
    expect(restoredAdvisor.tools.map((t) => t.type).sort()).toEqual(
      [...getAdvisorDefaultTools().map((t) => t.type)].sort()
    );
    const restoredLegacy = ensureSuperAgentDefaultTools(yahooOnly, "super-agent");
    expect(restoredLegacy.tools.map((t) => t.type).sort()).toEqual(
      [...getSuperAgentDefaultTools().map((t) => t.type)].sort()
    );
    expect(ensureSuperAgentDefaultTools(yahooOnly, "atx-trusted-advisor")).toEqual(yahooOnly);
  });

  it("mergeXchatHostedToolBaseline preserves admin-defined tool ordering", () => {
    const cfg = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [{ type: "web_search" }, { type: "x_search" }, { type: "atx_function" }]
    });
    const merged = mergeXchatHostedToolBaseline(cfg);
    expect(merged.tools.map((t) => t.type)).toEqual([
      "web_search",
      "x_search",
      "atx_function"
    ]);
  });

  it("normalizePersonaXapiConfig keeps one atx_function tool and preserves first-seen order", () => {
    const result = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [
        { type: "x_search" },
        { type: "atx_function" },
        { type: "web_search" },
        { type: "code_interpreter" }
      ]
    });
    expect(result.tools.map((t) => t.type)).toEqual([
      "x_search",
      "atx_function",
      "web_search",
      "code_interpreter"
    ]);
  });

  it("hasFileSearchTool detects file_search or collections_search in tool array", () => {
    expect(hasFileSearchTool([{ type: "web_search" }])).toBe(false);
    expect(hasFileSearchTool([{ type: "file_search" }])).toBe(true);
    expect(hasFileSearchTool([{ type: "collections_search" }])).toBe(true);
    expect(hasFileSearchTool(undefined)).toBe(false);
    expect(hasFileSearchTool([])).toBe(false);
  });

  it("createPersonaPayloadSchema rejects file_search without collection", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation.",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "file_search" }]
      }
    });
    expect(result.success).toBe(false);
  });

  it("createPersonaPayloadSchema allows file_search with collection", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation.",
      xaiCollection: {
        collectionId: "collection_abc-123"
      },
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "file_search" }]
      }
    });
    expect(result.success).toBe(true);
  });

  it("createPersonaPayloadSchema rejects collections_search without any collection binding", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation.",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "collections_search" }]
      }
    });
    expect(result.success).toBe(false);
  });

  it("createPersonaPayloadSchema allows collections_search with collection_ids on tool only", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation.",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "collections_search", collection_ids: ["collection_x"] }]
      }
    });
    expect(result.success).toBe(true);
  });

  it("createPersonaPayloadSchema allows collections_search with xaiCollection link", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation.",
      xaiCollection: {
        collectionId: "collection_abc-123"
      },
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "collections_search", collection_ids: ["collection_abc-123"] }]
      }
    });
    expect(result.success).toBe(true);
  });

  it("normalizePersonaXapiConfig keeps only one collection tool when both are present", () => {
    const result = normalizePersonaXapiConfig({
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [
        { type: "file_search", source: { collection_ids: ["a"] } },
        { type: "collections_search", collection_ids: ["b"] }
      ]
    });
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].type).toBe("file_search");
  });

  it("createPersonaPayloadSchema rejects unknown tool type", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation.",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "unknown_tool_type" }]
      }
    });
    expect(result.success).toBe(false);
  });

  it("createPersonaPayloadSchema allows code_interpreter tool type", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Code Agent",
      systemPrompt: "You are a test agent that can run quantitative calculations.",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: [{ type: "code_interpreter" }]
      }
    });
    expect(result.success).toBe(true);
  });

  it("createPersonaPayloadSchema allows empty tools array", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation.",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 5,
        tools: []
      }
    });
    expect(result.success).toBe(true);
  });

  it("createPersonaPayloadSchema defaults xapi when omitted", () => {
    const result = createPersonaPayloadSchema.safeParse({
      name: "Test Agent",
      systemPrompt: "You are a test agent for validation."
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.xapi.mode).toBe("responses");
      expect(result.data.xapi.toolChoice).toBe("auto");
      expect(result.data.xapi.maxTurns).toBe(5);
      expect(result.data.xapi.tools).toEqual([]);
    }
  });
});
