import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  addRoleToCoreUser: vi.fn(),
  ensureDefaultTenant: vi.fn(),
  updateCoreUserAccountStatus: vi.fn(),
  updateCoreUserSubscriptionPlan: vi.fn(),
  upsertTenantMembership: vi.fn()
}));

vi.mock("@/modules/identity/repository", () => repoMocks);
vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));

import { provisionGuestTrialOperatorAccess } from "@/modules/identity/guest-trial";
import type { CoreUser } from "@/modules/identity/types";

function user(overrides: Partial<CoreUser> = {}): CoreUser {
  return {
    _id: new ObjectId("507f1f77bcf86cd799439011"),
    email: "u@example.com",
    roles: [],
    status: "active",
    accountStatus: "pending_approval",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("provisionGuestTrialOperatorAccess existing-user skip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not upgrade a viewer", async () => {
    const result = await provisionGuestTrialOperatorAccess({
      user: user({ roles: ["viewer"], accountStatus: "approved" })
    });
    expect(result).toEqual({ ok: false, reason: "skip_existing" });
    expect(repoMocks.addRoleToCoreUser).not.toHaveBeenCalled();
  });

  it("does not flip an already-approved empty-role user to operator", async () => {
    const result = await provisionGuestTrialOperatorAccess({
      user: user({ roles: [], accountStatus: "approved" })
    });
    expect(result).toEqual({ ok: false, reason: "skip_existing" });
    expect(repoMocks.addRoleToCoreUser).not.toHaveBeenCalled();
  });
});
