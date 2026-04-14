import { describe, expect, it } from "vitest";

import { hashAuthLookupToken } from "@/lib/auth-token-hash";

describe("auth-token-hash", () => {
  it("is deterministic hex sha256", () => {
    const a = hashAuthLookupToken("token-one");
    const b = hashAuthLookupToken("token-one");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAuthLookupToken("token-two")).not.toBe(a);
  });
});
