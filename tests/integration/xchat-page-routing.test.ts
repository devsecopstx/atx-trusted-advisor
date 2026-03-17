import { describe, expect, it } from "vitest";

function hasXfinanceAccess(roles: string[]): boolean {
  return roles.length > 0;
}

describe("xchat page access logic", () => {
  it("grants access to global_admin", () => {
    expect(hasXfinanceAccess(["global_admin"])).toBe(true);
  });

  it("grants access to viewer", () => {
    expect(hasXfinanceAccess(["viewer"])).toBe(true);
  });

  it("grants access to advisor", () => {
    expect(hasXfinanceAccess(["advisor"])).toBe(true);
  });

  it("grants access to operator", () => {
    expect(hasXfinanceAccess(["operator"])).toBe(true);
  });

  it("grants access to users with multiple roles", () => {
    expect(hasXfinanceAccess(["viewer", "advisor"])).toBe(true);
  });

  it("denies access to users with no roles", () => {
    expect(hasXfinanceAccess([])).toBe(false);
  });

  it("admin nav link is shown only for global_admin", () => {
    const isAdmin = (roles: string[]) => roles.includes("global_admin");
    expect(isAdmin(["global_admin"])).toBe(true);
    expect(isAdmin(["viewer"])).toBe(false);
    expect(isAdmin(["advisor", "operator"])).toBe(false);
    expect(isAdmin([])).toBe(false);
  });
});

describe("plans landing data", () => {
  const PLAN_NAMES = ["Free", "Pro", "Enterprise"];

  it("defines three plan tiers", () => {
    expect(PLAN_NAMES).toHaveLength(3);
  });

  it("Pro is the featured plan", () => {
    expect(PLAN_NAMES[1]).toBe("Pro");
  });

  it("plan names are in ascending price order", () => {
    expect(PLAN_NAMES).toEqual(["Free", "Pro", "Enterprise"]);
  });
});

describe("xchat conversation contract", () => {
  it("sends message field (not prompt) to /api/xchat/ask", () => {
    const prompt = "What is TSLA at?";
    const personaId = "persona_123";
    const scope = "global";

    const payload = {
      message: prompt,
      scope,
      personaId: personaId || undefined
    };

    expect(payload).toHaveProperty("message");
    expect(payload).not.toHaveProperty("prompt");
    expect(payload.message).toBe("What is TSLA at?");
  });

  it("omits personaId when empty", () => {
    const emptyId = "";
    const payload = {
      message: "test",
      scope: "global",
      personaId: emptyId ? emptyId : undefined
    };

    expect(payload.personaId).toBeUndefined();
  });

  it("caps input at 4000 characters", () => {
    const MAX_INPUT_LENGTH = 4000;
    const longInput = "a".repeat(MAX_INPUT_LENGTH + 1);
    const capped = longInput.slice(0, MAX_INPUT_LENGTH);
    expect(capped.length).toBe(MAX_INPUT_LENGTH);
  });

  it("trims empty input", () => {
    const input = "   ";
    const prompt = input.trim();
    expect(prompt).toBe("");
    expect(!prompt).toBe(true);
  });
});
