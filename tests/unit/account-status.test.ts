import { describe, expect, it } from "vitest";

import {
    isCoreUserAccountAccessApproved,
    isCoreUserAccountRejected
} from "@/modules/identity/account-status";
import type { CoreUser } from "@/modules/identity/types";

function user(partial: Partial<CoreUser> & Pick<CoreUser, "email" | "roles" | "status">): CoreUser {
  const now = new Date();
  return {
    subscriptionPlan: partial.subscriptionPlan ?? "basic",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    ...partial
  };
}

describe("account-status helpers", () => {
  it("treats legacy rows without accountStatus as approved", () => {
    expect(
      isCoreUserAccountAccessApproved(
        user({
          email: "a@b.co",
          roles: [],
          status: "active"
        })
      )
    ).toBe(true);
  });

  it("requires explicit approved status when set", () => {
    expect(
      isCoreUserAccountAccessApproved(
        user({
          email: "a@b.co",
          roles: [],
          status: "active",
          accountStatus: "approved"
        })
      )
    ).toBe(true);
    expect(
      isCoreUserAccountAccessApproved(
        user({
          email: "a@b.co",
          roles: [],
          status: "active",
          accountStatus: "pending_approval"
        })
      )
    ).toBe(false);
    expect(
      isCoreUserAccountRejected(
        user({
          email: "a@b.co",
          roles: [],
          status: "active",
          accountStatus: "rejected"
        })
      )
    ).toBe(true);
  });
});
