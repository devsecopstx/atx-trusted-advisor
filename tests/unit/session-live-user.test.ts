import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userMocks = vi.hoisted(() => ({
  getCoreUserByIdCached: vi.fn()
}));

vi.mock("@/lib/server-request-cache", () => ({
  getCoreUserByIdCached: userMocks.getCoreUserByIdCached
}));

import { attachLiveRolesFromCoreUser } from "@/lib/session-live-user";

const session = {
  userId: "507f1f77bcf86cd799439011",
  email: "cookie@example.com",
  roles: ["global_admin"],
  tenantId: "507f1f77bcf86cd799439022",
  tenantRole: "tenant_admin",
  xUserId: "x1",
  username: "sam"
};

describe("attachLiveRolesFromCoreUser", () => {
  beforeEach(() => {
    userMocks.getCoreUserByIdCached.mockReset();
  });

  it("replaces cookie roles with Mongo roles", async () => {
    userMocks.getCoreUserByIdCached.mockResolvedValueOnce({
      _id: new ObjectId(session.userId),
      email: "live@example.com",
      roles: ["viewer"],
      status: "active"
    });
    const live = await attachLiveRolesFromCoreUser(session);
    expect(live.ok).toBe(true);
    if (live.ok) {
      expect(live.session.roles).toEqual(["viewer"]);
      expect(live.session.email).toBe("live@example.com");
    }
  });

  it("denies suspended users", async () => {
    userMocks.getCoreUserByIdCached.mockResolvedValueOnce({
      _id: new ObjectId(session.userId),
      email: "live@example.com",
      roles: ["global_admin"],
      status: "suspended"
    });
    const live = await attachLiveRolesFromCoreUser(session);
    expect(live).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });

  it("fail-closes when Mongo throws", async () => {
    userMocks.getCoreUserByIdCached.mockRejectedValueOnce(new Error("mongo down"));
    const live = await attachLiveRolesFromCoreUser(session);
    expect(live).toEqual({
      ok: false,
      status: 503,
      error: "Session verification unavailable"
    });
  });
});
