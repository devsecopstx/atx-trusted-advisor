import { describe, expect, it } from "vitest";

import {
    buildSessionToolInstructions,
    buildXchatSystemPrompt
} from "@/modules/xchat/xchat-prompt-build";

describe("buildSessionToolInstructions", () => {
  it("returns empty when no flags", () => {
    expect(buildSessionToolInstructions({ hostedSearch: false, atxfinance: false })).toBe("");
  });

  it("includes hosted copy when hostedSearch", () => {
    const s = buildSessionToolInstructions({ hostedSearch: true, atxfinance: false });
    expect(s).toContain("web_search");
    expect(s).toContain("native tool");
  });

  it("includes both sections when both flags", () => {
    const s = buildSessionToolInstructions({ hostedSearch: true, atxfinance: true });
    expect(s).toContain("web_search");
    expect(s).toContain("atx_function tool");
  });

  it("includes NL guidance for options/strategy preflight when atxfinance", () => {
    const s = buildSessionToolInstructions({ hostedSearch: false, atxfinance: true });
    expect(s).toContain("NL (natural language)");
    expect(s).toContain("strategy jobs");
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
    const iBeta = out.indexOf("Client UI (beta)");
    expect(iP).toBe(0);
    expect(iRag).toBeGreaterThan(iP);
    expect(iHist).toBeGreaterThan(iRag);
    expect(iSnap).toBeGreaterThan(iHist);
    expect(iSess).toBeGreaterThan(iSnap);
    expect(iBeta).toBeGreaterThan(iSess);
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
    expect(out).toContain("Client UI (beta)");
  });
});
