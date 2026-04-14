import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password-crypto";

describe("password-crypto", () => {
  it("verifies a freshly hashed password", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(h.startsWith("scrypt32768$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("rejects garbage stored values", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$foo")).toBe(false);
  });
});
