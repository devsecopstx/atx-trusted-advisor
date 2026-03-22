import { describe, expect, it } from "vitest";

import {
    createPersonaPayloadSchema,
    hasFileSearchTool
} from "@/modules/xchat/persona-validation";
import {
    ensureSuperAgentDefaultTools,
    normalizePersonaXapiConfig,
    PERSONA_XAPI_TOOL_TYPES,
    SUPER_AGENT_DEFAULT_TOOLS,
    SUPER_AGENT_NAME_NORMALIZED
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
        { type: "code_execution" as never },
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
      "file_search",
      "collections_search",
      "yahoo_finance",
      "atxfinance"
    ]);
  });

  it("SUPER_AGENT_DEFAULT_TOOLS has web_search, x_search, collections_search, yahoo_finance, and atxfinance", () => {
    expect(SUPER_AGENT_DEFAULT_TOOLS).toHaveLength(5);
    expect(SUPER_AGENT_DEFAULT_TOOLS.map((t) => t.type)).toEqual([
      "web_search",
      "x_search",
      "collections_search",
      "yahoo_finance",
      "atxfinance"
    ]);
    const collectionsSearch = SUPER_AGENT_DEFAULT_TOOLS.find(
      (t) => t.type === "collections_search"
    );
    expect(collectionsSearch).toHaveProperty("collection_ids");
  });

  it("ensureSuperAgentDefaultTools restores hosted tools when Mongo xapi.tools was stripped", () => {
    expect(SUPER_AGENT_NAME_NORMALIZED).toBe("super-agent");
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
    const restored = ensureSuperAgentDefaultTools(yahooOnly, "Super-Agent");
    expect(restored.tools.map((t) => t.type).sort()).toEqual(
      [...SUPER_AGENT_DEFAULT_TOOLS.map((t) => t.type)].sort()
    );
    expect(ensureSuperAgentDefaultTools(yahooOnly, "xFinance")).toEqual(yahooOnly);
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
        tools: [{ type: "code_execution" }]
      }
    });
    expect(result.success).toBe(false);
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
