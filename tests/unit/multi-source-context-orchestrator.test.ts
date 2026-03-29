import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const xaiMocks = vi.hoisted(() => ({
  searchDocumentsInCollections: vi.fn(),
  respondWithXai: vi.fn()
}));

const snapshotMocks = vi.hoisted(() => ({
  buildWorkspaceServerSnapshotBlock: vi.fn()
}));

const readinessMocks = vi.hoisted(() => ({
  getScopeReadinessSummary: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  retrieveRagChunks: vi.fn()
}));

const marketMocks = vi.hoisted(() => ({
  getYahooMarketQuote: vi.fn()
}));

vi.mock("@/lib/xai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/xai")>("@/lib/xai");
  return {
    ...actual,
    searchDocumentsInCollections: xaiMocks.searchDocumentsInCollections,
    respondWithXai: xaiMocks.respondWithXai
  };
});

vi.mock("@/modules/xchat/workspace-snapshot-for-prompt", () => snapshotMocks);
vi.mock("@/modules/xchat/rag-file-readiness", () => readinessMocks);
vi.mock("@/modules/xchat/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/xchat/repository")>(
    "@/modules/xchat/repository"
  );
  return {
    ...actual,
    retrieveRagChunks: repoMocks.retrieveRagChunks
  };
});
vi.mock("@/modules/xchat/market-data", () => marketMocks);

import {
    extractTickerCandidates,
    formatGatheredContextForPrompt,
    gatherMultiSourceWorkspaceContext,
    runMultiSourceWorkspaceSynthesis
} from "@/modules/xchat/multi-source-context-orchestrator";
import type { PersonaConfig } from "@/modules/xchat/types";

function basePersona(overrides?: Partial<PersonaConfig>): PersonaConfig {
  return {
    name: "Test",
    nameNormalized: "test",
    systemPrompt: "You are a test persona.",
    overridePrompt: "",
    xaiCollection: { collectionId: "col_test", collectionName: "Test KB" },
    model: "grok-test",
    temperature: 0.2,
    enableRag: true,
    defaultScope: "global",
    xapi: {
      mode: "responses",
      toolChoice: "auto",
      maxTurns: 5,
      tools: [
        { type: "atx_function" },
        { type: "yahoo_finance" },
        { type: "collections_search", collection_ids: ["col_test"] }
      ]
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("extractTickerCandidates", () => {
  it("pulls uppercase tickers and skips common words", () => {
    expect(extractTickerCandidates("TSLA AAPL NVDA", 5)).toEqual(["TSLA", "AAPL", "NVDA"]);
    expect(extractTickerCandidates("THE AND FOR", 5)).toEqual([]);
  });
});

describe("gatherMultiSourceWorkspaceContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readinessMocks.getScopeReadinessSummary.mockResolvedValue({
      blocked: false,
      nonReadyFiles: []
    });
    snapshotMocks.buildWorkspaceServerSnapshotBlock.mockResolvedValue("SNAPSHOT_BLOCK");
    xaiMocks.searchDocumentsInCollections.mockResolvedValue([
      { text: "doc snippet", documentName: "a.md" }
    ]);
    repoMocks.retrieveRagChunks.mockResolvedValue([
      {
        _id: new ObjectId(),
        fileId: new ObjectId(),
        scope: "global",
        chunkIndex: 0,
        text: "mongo chunk",
        tokenEstimate: 10,
        createdAt: new Date()
      }
    ]);
    marketMocks.getYahooMarketQuote.mockImplementation(async ({ symbol }) => ({
      symbol: symbol ?? "TSLA",
      price: 100,
      source: "yahoo-finance2",
      disclaimer: "d"
    }));
  });

  it("runs snapshot, xAI RAG, mongo RAG, and Yahoo when persona allows", async () => {
    const gathered = await gatherMultiSourceWorkspaceContext({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      message: "TSLA outlook?",
      persona: basePersona()
    });

    expect(snapshotMocks.buildWorkspaceServerSnapshotBlock).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022"
    });
    expect(xaiMocks.searchDocumentsInCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionIds: expect.arrayContaining(["col_test"]),
        query: "TSLA outlook?"
      })
    );
    expect(repoMocks.retrieveRagChunks).toHaveBeenCalled();
    expect(marketMocks.getYahooMarketQuote).toHaveBeenCalled();
    expect(gathered.workspaceSnapshotBlock).toBe("SNAPSHOT_BLOCK");
    expect(gathered.xaiCollectionSnippets).toHaveLength(1);
    expect(gathered.mongoRagChunks).toHaveLength(1);
    expect(gathered.quotesBySymbol.TSLA).toBeDefined();
    expect(gathered.meta.yahooSymbolsRequested).toContain("TSLA");
  });

  it("skips snapshot without atx_function tool", async () => {
    await gatherMultiSourceWorkspaceContext({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      message: "hello",
      persona: basePersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "web_search" }]
        }
      })
    });
    expect(snapshotMocks.buildWorkspaceServerSnapshotBlock).not.toHaveBeenCalled();
  });

  it("skips Yahoo batch without yahoo_finance or atx_function", async () => {
    await gatherMultiSourceWorkspaceContext({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      message: "NVDA",
      persona: basePersona({
        xapi: {
          mode: "responses",
          toolChoice: "auto",
          maxTurns: 5,
          tools: [{ type: "web_search" }]
        }
      })
    });
    expect(marketMocks.getYahooMarketQuote).not.toHaveBeenCalled();
  });

  it("skips xAI collection search when readiness blocked", async () => {
    readinessMocks.getScopeReadinessSummary.mockResolvedValueOnce({
      blocked: true,
      nonReadyFiles: [{ fileId: "x", readiness: "pending_embeddings", processingStatus: "pending", checkedAt: "" }]
    });
    const gathered = await gatherMultiSourceWorkspaceContext({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      message: "q",
      persona: basePersona()
    });
    expect(xaiMocks.searchDocumentsInCollections).not.toHaveBeenCalled();
    expect(gathered.meta.collectionSearchSkippedReason).toBe("blocked_non_ready_files");
  });
});

describe("formatGatheredContextForPrompt", () => {
  it("includes sections when present", () => {
    const text = formatGatheredContextForPrompt({
      workspaceSnapshotBlock: "WS",
      xaiCollectionSnippets: [{ text: "s", documentName: "d" }],
      mongoRagChunks: [],
      quotesBySymbol: {},
      errors: [],
      meta: {
        linkedCollectionIds: [],
        xaiCollectionSearchRan: true,
        mongoRagRan: false,
        yahooSymbolsRequested: []
      }
    });
    expect(text).toContain("Workspace");
    expect(text).toContain("WS");
    expect(text).toContain("Persona-linked xAI collection");
  });
});

describe("runMultiSourceWorkspaceSynthesis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readinessMocks.getScopeReadinessSummary.mockResolvedValue({
      blocked: false,
      nonReadyFiles: []
    });
    snapshotMocks.buildWorkspaceServerSnapshotBlock.mockResolvedValue(null);
    xaiMocks.searchDocumentsInCollections.mockResolvedValue([]);
    repoMocks.retrieveRagChunks.mockResolvedValue([]);
    xaiMocks.respondWithXai.mockResolvedValue({
      outputText: "synth answer",
      model: "grok-test",
      raw: {}
    });
  });

  it("returns synthesis output", async () => {
    const out = await runMultiSourceWorkspaceSynthesis({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      message: "hi",
      persona: basePersona({ xapi: { mode: "responses", toolChoice: "auto", maxTurns: 5, tools: [] } })
    });
    expect(out.outputText).toBe("synth answer");
    expect(xaiMocks.respondWithXai).toHaveBeenCalledWith(
      expect.objectContaining({
        toolChoice: "none",
        userPrompt: expect.stringContaining("hi")
      })
    );
  });
});
