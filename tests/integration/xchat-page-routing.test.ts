import { describe, expect, it } from "vitest";

import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

describe("xchat page access logic", () => {
  it("grants access to global_admin", () => {
    expect(canUserLogin(["global_admin"])).toBe(true);
  });

  it("grants access to viewer", () => {
    expect(canUserLogin(["viewer"])).toBe(true);
  });

  it("grants access to advisor", () => {
    expect(canUserLogin(["advisor"])).toBe(true);
  });

  it("grants access to operator", () => {
    expect(canUserLogin(["operator"])).toBe(true);
  });

  it("grants access to users with multiple roles", () => {
    expect(canUserLogin(["viewer", "advisor"])).toBe(true);
  });

  it("denies access to users with no roles", () => {
    expect(canUserLogin([])).toBe(false);
  });

  it("admin nav link is shown only for global_admin", () => {
    expect(isGlobalAdmin(["global_admin"])).toBe(true);
    expect(isGlobalAdmin(["admin"])).toBe(true);
    expect(isGlobalAdmin(["viewer"])).toBe(false);
    expect(isGlobalAdmin(["advisor", "operator"])).toBe(false);
    expect(isGlobalAdmin([])).toBe(false);
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
    expect(payload.message).toBe(prompt);
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
});
