import { describe, expect, it } from "vitest";

import { clampToolLoopMaxTurnsForSession } from "@/modules/xchat/plan-limits";

describe("clampToolLoopMaxTurnsForSession", () => {
  it("caps app users by plan tier", () => {
    expect(
      clampToolLoopMaxTurnsForSession({
        personaMaxTurns: 10,
        plan: "basic",
        isAdminSession: false
      })
    ).toBe(3);
    expect(
      clampToolLoopMaxTurnsForSession({
        personaMaxTurns: 10,
        plan: "premium",
        isAdminSession: false
      })
    ).toBe(5);
  });

  it("does not cap global_admin below persona maxTurns", () => {
    expect(
      clampToolLoopMaxTurnsForSession({
        personaMaxTurns: 10,
        plan: "basic",
        isAdminSession: true
      })
    ).toBe(10);
  });
});
