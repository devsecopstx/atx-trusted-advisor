import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { normalizeMongoUserIdHex } from "@/modules/identity/repository";

describe("normalizeMongoUserIdHex", () => {
  const hex = "64a1b2c3d4e5f678901234ab";

  it("returns trimmed string ids", () => {
    expect(normalizeMongoUserIdHex(`  ${hex}  `)).toBe(hex);
  });

  it("returns null for empty / whitespace-only strings", () => {
    expect(normalizeMongoUserIdHex("")).toBeNull();
    expect(normalizeMongoUserIdHex("   ")).toBeNull();
    expect(normalizeMongoUserIdHex(null)).toBeNull();
    expect(normalizeMongoUserIdHex(undefined)).toBeNull();
  });

  it("stringifies ObjectId to hex (legacy portfolio.userId shape)", () => {
    const oid = new ObjectId(hex);
    expect(normalizeMongoUserIdHex(oid)).toBe(hex);
  });

  it("handles duck-typed toHexString (legacy BSON shape)", () => {
    expect(normalizeMongoUserIdHex({ toHexString: () => hex })).toBe(hex);
  });
});
