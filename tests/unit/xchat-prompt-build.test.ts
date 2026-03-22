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
    expect(s).toContain("atxfinance tool");
  });
});

describe("buildXchatSystemPrompt", () => {
  it("locks order: persona, RAG, snapshot, session", () => {
    const out = buildXchatSystemPrompt({
      personaSystem: "P",
      fallbackPersonaSystem: "F",
      ragContext: "rag",
      workspaceSnapshot: "SNAP",
      sessionToolInstructions: "SESS"
    });
    const iP = out.indexOf("P");
    const iRag = out.indexOf("Use the following RAG");
    const iSnap = out.indexOf("SNAP");
    const iSess = out.indexOf("SESS");
    expect(iP).toBe(0);
    expect(iRag).toBeGreaterThan(iP);
    expect(iSnap).toBeGreaterThan(iRag);
    expect(iSess).toBeGreaterThan(iSnap);
  });

  it("uses fallback persona when base empty", () => {
    expect(
      buildXchatSystemPrompt({
        personaSystem: "   ",
        fallbackPersonaSystem: "FALL",
        ragContext: "",
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
      workspaceSnapshot: null,
      sessionToolInstructions: ""
    });
    expect(out).toContain("Hi");
    expect(out).toContain("No RAG context available.");
    expect(out).not.toContain("SNAP");
  });
});
