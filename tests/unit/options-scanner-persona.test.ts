import { beforeEach, describe, expect, it, vi } from "vitest";

const getPersonaMock = vi.hoisted(() => vi.fn());
const yahooQuoteMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    symbol: "TSLA",
    price: 100,
    source: "yahoo-finance2",
    disclaimer: "d"
  })
);

vi.mock("@/modules/xchat/repository", () => ({
  getPersonaByNormalizedName: getPersonaMock
}));

vi.mock("@/modules/xchat/market-data", () => ({
  getYahooMarketQuote: yahooQuoteMock
}));

import {
    OPTIONS_SCANNER_DEFAULT_PERSONA_NAME,
    createOptionsScannerToolExecutor,
    resolveOptionsScannerPersonaContext
} from "@/modules/strategy-options/options-scanner-persona";

describe("createOptionsScannerToolExecutor", () => {
  beforeEach(() => {
    yahooQuoteMock.mockClear();
  });

  it("runs yahoo_finance for a symbol", async () => {
    yahooQuoteMock.mockResolvedValueOnce({
      symbol: "NVDA",
      price: 50,
      source: "yahoo-finance2",
      disclaimer: "d"
    });
    const ex = createOptionsScannerToolExecutor();
    const r = await ex("yahoo_finance", { symbol: "NVDA" });
    expect(yahooQuoteMock).toHaveBeenCalledWith({ symbol: "NVDA" });
    expect(r.error).toBeUndefined();
    expect(r.result ?? "").toContain("NVDA");
  });

  it("returns structured error for atx_function", async () => {
    const ex = createOptionsScannerToolExecutor();
    const r = await ex("atx_function", { operation: "portfolio_summary" });
    expect(r.result).toContain("options_scanner_no_workspace");
    expect(yahooQuoteMock).not.toHaveBeenCalled();
  });
});

describe("resolveOptionsScannerPersonaContext", () => {
  beforeEach(() => {
    getPersonaMock.mockReset();
    delete process.env.OPTIONS_SCANNER_PERSONA_NAME;
  });

  it("returns null when persona is missing", async () => {
    getPersonaMock.mockResolvedValue(null);
    const ctx = await resolveOptionsScannerPersonaContext();
    expect(ctx).toBeNull();
    expect(getPersonaMock).toHaveBeenCalledWith(OPTIONS_SCANNER_DEFAULT_PERSONA_NAME);
  });

  it("returns null for draft persona", async () => {
    getPersonaMock.mockResolvedValue({
      _id: "x",
      systemPrompt: "sys",
      overridePrompt: "",
      model: "grok-test",
      temperature: 0.2,
      status: "draft",
      xapi: { tools: [], toolChoice: "auto", maxTurns: 3, mode: "responses" }
    });
    expect(await resolveOptionsScannerPersonaContext()).toBeNull();
  });

  it("builds context for published persona with tools", async () => {
    getPersonaMock.mockResolvedValue({
      _id: "x",
      systemPrompt: "You are a test advisor.",
      overridePrompt: "Extra.",
      model: "grok-4-1-fast-reasoning",
      temperature: 0.11,
      status: "published",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 4,
        tools: [{ type: "yahoo_finance" }]
      }
    });
    const ctx = await resolveOptionsScannerPersonaContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.systemPrompt).toContain("You are a test advisor.");
    expect(ctx!.systemPrompt).toContain("Scanner refinement");
    expect(ctx!.model).toBe("grok-4-1-fast-reasoning");
    expect(ctx!.temperature).toBe(0.11);
    expect(ctx!.tools.length).toBeGreaterThan(0);
    expect(ctx!.maxTurns).toBe(4);
  });
});
