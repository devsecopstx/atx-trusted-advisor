import { beforeEach, describe, expect, it, vi } from "vitest";

const getPersonaMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/xchat/repository", () => ({
  getPersonaByNormalizedName: getPersonaMock
}));

vi.mock("@/lib/xai", () => ({
  respondWithXai: vi.fn(),
  respondWithXaiToolLoop: vi.fn()
}));

import { respondWithXai } from "@/lib/xai";
import {
    refineWatchlistRowRationaleWithPersona,
    resolveWatchlistScannerPersonaContext,
    WATCHLIST_SCANNER_DEFAULT_PERSONA_NAME,
    watchlistScannerGrokEnv
} from "@/modules/watchlist/watchlist-scanner-persona";

describe("resolveWatchlistScannerPersonaContext", () => {
  beforeEach(() => {
    getPersonaMock.mockReset();
    delete process.env.WATCHLIST_SCANNER_PERSONA_NAME;
  });

  it("returns null when persona is missing", async () => {
    getPersonaMock.mockResolvedValue(null);
    const ctx = await resolveWatchlistScannerPersonaContext();
    expect(ctx).toBeNull();
    expect(getPersonaMock).toHaveBeenCalledWith(WATCHLIST_SCANNER_DEFAULT_PERSONA_NAME);
  });

  it("returns null for archived persona", async () => {
    getPersonaMock.mockResolvedValue({
      _id: "x",
      systemPrompt: "sys",
      overridePrompt: "",
      model: "grok-test",
      temperature: 0.2,
      status: "archived",
      xapi: { tools: [], toolChoice: "auto", maxTurns: 3, mode: "responses" }
    });
    expect(await resolveWatchlistScannerPersonaContext()).toBeNull();
  });

  it("appends watchlist scanner contract to system prompt", async () => {
    getPersonaMock.mockResolvedValue({
      _id: "x",
      systemPrompt: "Desk advisor.",
      overridePrompt: "",
      model: "grok-4-1-fast-reasoning",
      temperature: 0.12,
      status: "published",
      xapi: {
        mode: "responses",
        toolChoice: "auto",
        maxTurns: 3,
        tools: []
      }
    });
    const ctx = await resolveWatchlistScannerPersonaContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.systemPrompt).toContain("Desk advisor.");
    expect(ctx!.systemPrompt).toContain("Watchlist price-scan turn");
  });
});

describe("refineWatchlistRowRationaleWithPersona", () => {
  it("parses rationale JSON from model output", async () => {
    vi.mocked(respondWithXai).mockResolvedValueOnce({
      model: "m",
      outputText: '{"rationale":"Spot moved; reassess put spread width."}',
      raw: {}
    });
    const ctx = {
      systemPrompt: "s",
      model: "m",
      temperature: 0.1,
      tools: [] as Array<Record<string, unknown>>,
      toolChoice: "auto" as const,
      maxTurns: 2
    };
    const line = await refineWatchlistRowRationaleWithPersona(ctx, {
      symbol: "TSLA",
      spotPrice: 250
    });
    expect(line).toBe("Spot moved; reassess put spread width.");
  });
});

describe("watchlistScannerGrokEnv", () => {
  it("defaults grok on and max calls 40", () => {
    delete process.env.WATCHLIST_SCANNER_GROK_ENABLED;
    delete process.env.WATCHLIST_SCANNER_GROK_MAX_CALLS;
    const e = watchlistScannerGrokEnv();
    expect(e.grokEnabled).toBe(true);
    expect(e.maxGrokCalls).toBe(40);
  });
});
