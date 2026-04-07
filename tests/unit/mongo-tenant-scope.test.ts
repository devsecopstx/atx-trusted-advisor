import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
    mongoAppUserRecommendationsScope,
    mongoMatchNothingFilter,
    mongoPortfolioFamilyUserPortfolioScope,
    mongoPortfolioFamilyUserScope,
    mongoTenantExactScope,
    mongoUserIdQuery,
    mongoXchatLogsTenantScope,
    parseTenantObjectId
} from "@/lib/mongo-tenant-scope";

describe("mongo-tenant-scope", () => {
  it("parseTenantObjectId rejects empty and invalid hex", () => {
    expect(parseTenantObjectId("")).toBeUndefined();
    expect(parseTenantObjectId("not-an-oid")).toBeUndefined();
    expect(parseTenantObjectId("507f1f77bcf86cd799439011")).toBeInstanceOf(ObjectId);
  });

  it("mongoMatchNothingFilter never matches (structure)", () => {
    const f = mongoMatchNothingFilter();
    expect(f._id.$in).toEqual([]);
  });

  it("mongoTenantExactScope denies when tenant hex invalid", () => {
    const base = { userId: "u1" };
    const f = mongoTenantExactScope(base, "bad", "deny");
    expect(f).toEqual({
      $and: [base, mongoMatchNothingFilter()]
    });
  });

  it("mongoTenantExactScope merges tenant when valid", () => {
    const hex = "507f1f77bcf86cd799439011";
    const f = mongoTenantExactScope({ a: 1 }, hex, "deny");
    expect(f).toEqual({ a: 1, tenantId: new ObjectId(hex) });
  });

  it("mongoPortfolioFamilyUserScope denies invalid tenant for session-style reads", () => {
    const f = mongoPortfolioFamilyUserScope("userhex", "bad", "denyIfTenantMissing");
    expect(f).toEqual({
      $and: [mongoUserIdQuery("userhex"), mongoMatchNothingFilter()]
    });
  });

  it("mongoPortfolioFamilyUserScope allows legacy user-only scope when opted in", () => {
    const f = mongoPortfolioFamilyUserScope("userhex", "bad", "allowLegacyUserScope");
    expect(f).toEqual(mongoUserIdQuery("userhex"));
  });

  it("mongoPortfolioFamilyUserPortfolioScope denies invalid portfolio id", () => {
    const f = mongoPortfolioFamilyUserPortfolioScope("u", "bad-portfolio-id", "507f1f77bcf86cd799439011");
    expect(f).toEqual({
      $and: [mongoUserIdQuery("u"), mongoMatchNothingFilter()]
    });
  });

  it("mongoAppUserRecommendationsScope denies when tenant missing and deny mode", () => {
    const base = { userId: "x", _id: new ObjectId() };
    const f = mongoAppUserRecommendationsScope(base, undefined, "denyIfTenantMissing");
    expect(f).toEqual({ $and: [base, mongoMatchNothingFilter()] });
  });

  it("mongoXchatLogsTenantScope denies userTenant mode without ObjectId", () => {
    const q = { userId: new ObjectId() };
    const f = mongoXchatLogsTenantScope(q, null, "userTenant");
    expect(f).toEqual({ $and: [q, mongoMatchNothingFilter()] });
  });

  it("mongoXchatLogsTenantScope leaves query unscoped for allTenants worker mode", () => {
    const q = { a: 1 };
    expect(mongoXchatLogsTenantScope(q, null, "allTenants")).toBe(q);
  });
});
