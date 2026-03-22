import { describe, expect, it } from "vitest";

import { caughtErrorMessage } from "@/lib/caught-error";

describe("caughtErrorMessage", () => {
  it("returns Error message", () => {
    expect(caughtErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies Mongo-style object with errmsg", () => {
    expect(caughtErrorMessage({ code: 11000, errmsg: "dup key" })).toBe("11000: dup key");
  });

  it("reads Mongo driver-style errorResponse", () => {
    expect(
      caughtErrorMessage({
        errorResponse: { code: 121, errmsg: "document failed validation" }
      })
    ).toBe("121: document failed validation");
  });

  it("falls back for empty plain object", () => {
    const s = caughtErrorMessage({});
    expect(s).toContain("plain object");
    expect(s.length).toBeGreaterThan(0);
  });
});
