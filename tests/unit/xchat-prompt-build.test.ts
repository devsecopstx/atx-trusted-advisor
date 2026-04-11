import { describe, expect, it } from "vitest";

import {
    buildSessionToolInstructions,
    buildXchatSystemPrompt,
    computeXchatRemoteChainInstructionsFingerprint,
    XCHAT_SERVER_ROUTING_POLICY_BLOCK
} from "@/modules/xchat/xchat-prompt-build";

describe("buildSessionToolInstructions", () => {
  it("returns empty when no flags", () => {
    expect(buildSessionToolInstructions({ hostedSearch: false, atxFunction: false })).toBe("");
  });

  it("includes hosted copy when hostedSearch", () => {
    const s = buildSessionToolInstructions({ hostedSearch: true, atxFunction: false });
    expect(s).toContain("web_search");
    expect(s).toContain("native tool");
  });

  it("includes both sections when both flags", () => {
    const s = buildSessionToolInstructions({ hostedSearch: true, atxFunction: true });
    expect(s).toContain("web_search");
    expect(s).toContain("Workspace tools");
    expect(s).toContain("atx_function");
  });

  it("includes NL guidance for options/strategy preflight when atx_function is enabled", () => {
    const s = buildSessionToolInstructions({ hostedSearch: false, atxFunction: true });
    expect(s).toContain("NL (natural language)");
    expect(s).toContain("strategy jobs");
  });

  it("requires full watchlist enumeration with spot, notional USD, and desk entry fields", () => {
    const s = buildSessionToolInstructions({ hostedSearch: false, atxFunction: true });
    expect(s).toContain("spotPriceDisplay");
    expect(s).toContain("targetEntryNotional100xUsdDisplay");
    expect(s).toContain("targetEntryDisplay");
    expect(s).toContain("enumerate **every symbol returned**");
  });
});

describe("computeXchatRemoteChainInstructionsFingerprint", () => {
  const base = {
    personaSystem: "You are The Advisor.",
    personaUpdatedAtMs: 1_700_000_000_000,
    strategyJobOptOut: false,
    hostedSearch: true,
    atxFunction: true,
    citationsEnabled: true
  };

  it("is stable for identical inputs", () => {
    const a = computeXchatRemoteChainInstructionsFingerprint(base);
    const b = computeXchatRemoteChainInstructionsFingerprint({ ...base });
    expect(a).toBe(b);
    expect(a.length).toBe(24);
  });

  it("changes when persona system text changes", () => {
    const a = computeXchatRemoteChainInstructionsFingerprint(base);
    const b = computeXchatRemoteChainInstructionsFingerprint({
      ...base,
      personaSystem: "Different."
    });
    expect(a).not.toBe(b);
  });

  it("changes when persona updatedAt changes", () => {
    const a = computeXchatRemoteChainInstructionsFingerprint(base);
    const b = computeXchatRemoteChainInstructionsFingerprint({
      ...base,
      personaUpdatedAtMs: base.personaUpdatedAtMs + 1
    });
    expect(a).not.toBe(b);
  });
});

describe("buildXchatSystemPrompt", () => {
  it("locks order: persona, RAG, recent history, snapshot, session", () => {
    const out = buildXchatSystemPrompt({
      personaSystem: "P",
      fallbackPersonaSystem: "F",
      ragContext: "rag",
      recentHistoryBlock: "HIST",
      workspaceSnapshot: "SNAP",
      sessionToolInstructions: "SESS"
    });
    const iP = out.indexOf("P");
    const iRag = out.indexOf("Use the following RAG");
    const iHist = out.indexOf("HIST");
    const iSnap = out.indexOf("SNAP");
    const iSess = out.indexOf("SESS");
    const iCite = out.indexOf("Citation chips");
    const iBeta = out.indexOf("Client UI (beta)");
    expect(iP).toBe(0);
    expect(iRag).toBeGreaterThan(iP);
    expect(iHist).toBeGreaterThan(iRag);
    expect(iSnap).toBeGreaterThan(iHist);
    expect(iSess).toBeGreaterThan(iSnap);
    expect(iCite).toBeGreaterThan(iSess);
    expect(iBeta).toBeGreaterThan(iCite);
  });

  it("uses fallback persona when base empty", () => {
    expect(
      buildXchatSystemPrompt({
        personaSystem: "   ",
        fallbackPersonaSystem: "FALL",
        ragContext: "",
        recentHistoryBlock: null,
        workspaceSnapshot: null,
        sessionToolInstructions: ""
      }).startsWith("FALL")
    ).toBe(true);
  });

  it("omits snapshot and session blocks when empty", () => {
    const out = buildXchatSystemPrompt({
      personaSystem: "Hi",
      fallbackPersonaSystem: "F",
      ragContext: "",
      recentHistoryBlock: undefined,
      workspaceSnapshot: null,
      sessionToolInstructions: ""
    });
    expect(out).toContain("Hi");
    expect(out).toContain("No RAG context available.");
    expect(out).not.toContain("SNAP");
    expect(out).toContain("Citation chips");
    expect(out).toContain("Client UI (beta)");
  });

  it("inserts routing policy block between session tools and citation contract when provided", () => {
    const out = buildXchatSystemPrompt({
      personaSystem: "P",
      fallbackPersonaSystem: "F",
      ragContext: "",
      recentHistoryBlock: undefined,
      workspaceSnapshot: null,
      sessionToolInstructions: "SESS",
      routingPolicyBlock: XCHAT_SERVER_ROUTING_POLICY_BLOCK
    });
    const iSess = out.indexOf("SESS");
    const iRoute = out.indexOf("Server routing policy");
    const iCite = out.indexOf("Citation chips");
    expect(iSess).toBeGreaterThan(-1);
    expect(iRoute).toBeGreaterThan(iSess);
    expect(iCite).toBeGreaterThan(iRoute);
  });

  it("uses no-citations instruction when citationsEnabled is false", () => {
    const out = buildXchatSystemPrompt({
      personaSystem: "Hi",
      fallbackPersonaSystem: "F",
      ragContext: "",
      recentHistoryBlock: undefined,
      workspaceSnapshot: null,
      sessionToolInstructions: "",
      citationsEnabled: false
    });
    expect(out).toContain("Hi");
    expect(out).not.toContain("Citation chips");
    expect(out).toContain("Do not use xChat citation chips");
    expect(out).toContain("Client UI (beta)");
  });
});
