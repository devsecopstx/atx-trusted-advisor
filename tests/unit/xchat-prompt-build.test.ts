import { describe, expect, it } from "vitest";

import {
    buildSessionToolInstructions,
    buildXchatSystemPrompt,
    classifyXchatSessionToolCopyMode,
    computeXchatRemoteChainInstructionsFingerprint,
    formatTenantWorkspaceContextBlockForXchat,
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

  it("adds HNWI CSP summary-table contract for options_scan output", () => {
    const s = buildSessionToolInstructions({ hostedSearch: false, atxFunction: true });
    expect(s).toContain("options_scan");
    expect(s).toContain("HNWI desk style");
    expect(s).toContain("Strike | Premium | IV | OI | Delta | Breakeven | ROC (ann.) | Cash Req | Assignment Risk | Desk Note");
    expect(s).toContain("max 5 rows total");
    expect(s).toContain("Top 3 ranked ideas");
    expect(s).toContain("degrade gracefully");
  });

  it("adds HNWI covered-call summary-table contract for options_scan output", () => {
    const s = buildSessionToolInstructions({ hostedSearch: false, atxFunction: true });
    expect(s).toContain("covered-call idea requests");
    expect(s).toContain(
      "Strike | Premium | IV | OI | Delta | Upside to Strike | ROC (ann.) | Notional (100sh) | Call-Away Risk | Desk Note"
    );
    expect(s).toContain("Best Upside/Income Balance");
    expect(s).toContain("Upside to Strike = ((strike - spot) / spot) * 100");
    expect(s).toContain("ROC (ann.) = (premium/spot) * (365/DTE)");
  });

  it("slim omits HNWI desk style for options_scan", () => {
    const s = buildSessionToolInstructions({ hostedSearch: false, atxFunction: true }, "slim");
    expect(s).not.toContain("HNWI desk style");
    expect(s).toContain("options_scan");
    expect(s).toContain("avoid redundant tool calls");
  });
});

describe("classifyXchatSessionToolCopyMode", () => {
  it("returns slim for empty message", () => {
    expect(classifyXchatSessionToolCopyMode("")).toBe("slim");
  });

  it("returns slim for generic chit-chat", () => {
    expect(classifyXchatSessionToolCopyMode("Hello")).toBe("slim");
  });

  it("returns slim for educational stub without portfolio cues", () => {
    expect(classifyXchatSessionToolCopyMode("What is a covered call?")).toBe("slim");
  });

  it("returns full when educational stub references my portfolio", () => {
    expect(classifyXchatSessionToolCopyMode("What is a covered call on my TSLA holdings?")).toBe("full");
  });

  it("returns full for wheel / income intents", () => {
    expect(classifyXchatSessionToolCopyMode("Covered call ideas on AAPL")).toBe("full");
    expect(classifyXchatSessionToolCopyMode("Wheel strategy using my watchlist")).toBe("full");
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

  it("changes when tenant workspace context block changes", () => {
    const a = computeXchatRemoteChainInstructionsFingerprint(base);
    const b = computeXchatRemoteChainInstructionsFingerprint({
      ...base,
      tenantWorkspaceContextBlock: "Tenant workspace (display only): Desk."
    });
    expect(a).not.toBe(b);
  });
});

describe("formatTenantWorkspaceContextBlockForXchat", () => {
  it("returns null for empty tenant name", () => {
    expect(formatTenantWorkspaceContextBlockForXchat({ tenantName: "  " })).toBeNull();
  });

  it("merges brand + tenant name when both differ", () => {
    const s = formatTenantWorkspaceContextBlockForXchat({
      tenantName: "Acme RIA",
      xchatBrandName: "Acme Advisor Chat"
    });
    expect(s).toContain("Acme Advisor Chat (Acme RIA)");
    expect(s).toContain("display only");
  });
});

describe("buildXchatSystemPrompt", () => {
  it("prefixes optional tenant workspace block before persona", () => {
    const out = buildXchatSystemPrompt({
      tenantWorkspaceContextBlock: "TEN",
      personaSystem: "P",
      fallbackPersonaSystem: "F",
      ragContext: "rag",
      recentHistoryBlock: null,
      workspaceSnapshot: null,
      sessionToolInstructions: ""
    });
    expect(out.indexOf("TEN")).toBe(0);
    expect(out.indexOf("P")).toBeGreaterThan(0);
  });

  it("locks order: stable prefix (persona, session, citations, beta) then volatile (RAG, history, snapshot)", () => {
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
    expect(iSess).toBeGreaterThan(iP);
    expect(iCite).toBeGreaterThan(iSess);
    expect(iBeta).toBeGreaterThan(iCite);
    expect(iRag).toBeGreaterThan(iBeta);
    expect(iHist).toBeGreaterThan(iRag);
    expect(iSnap).toBeGreaterThan(iHist);
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
