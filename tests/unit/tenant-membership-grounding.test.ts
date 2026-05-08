import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { normalizeTenantIdHexFromStoredMembershipField } from "@/modules/identity/tenant-membership-grounding";

describe("normalizeTenantIdHexFromStoredMembershipField", () => {
  const oid = new ObjectId("507f1f77bcf86cd799439011");

  it("returns canonical hex for ObjectId", () => {
    expect(normalizeTenantIdHexFromStoredMembershipField(oid)).toBe("507f1f77bcf86cd799439011");
  });

  it("normalizes valid 24-char hex strings", () => {
    expect(normalizeTenantIdHexFromStoredMembershipField("507f1f77bcf86cd799439011")).toBe(
      "507f1f77bcf86cd799439011"
    );
    expect(normalizeTenantIdHexFromStoredMembershipField(" 507f1f77bcf86cd799439011 ")).toBe(
      "507f1f77bcf86cd799439011"
    );
  });

  it("returns null for empty, invalid string, or unknown shapes", () => {
    expect(normalizeTenantIdHexFromStoredMembershipField(null)).toBeNull();
    expect(normalizeTenantIdHexFromStoredMembershipField(undefined)).toBeNull();
    expect(normalizeTenantIdHexFromStoredMembershipField("")).toBeNull();
    expect(normalizeTenantIdHexFromStoredMembershipField("not-an-objectid")).toBeNull();
    expect(normalizeTenantIdHexFromStoredMembershipField({ foo: 1 })).toBeNull();
  });
});
