import { describe, expect, it } from "vitest";

import {
    assertUserEligibleForEmailVerificationResend,
    getAdminUserEmailVerificationResendFields
} from "@/lib/admin-user-email-verification";
import type { CoreUser } from "@/modules/identity/types";

function coreUser(partial: Partial<CoreUser> & Pick<CoreUser, "email" | "roles">): CoreUser {
  const now = new Date();
  return {
    subscriptionPlan: "basic",
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...partial
  } as CoreUser;
}

describe("admin-user-email-verification", () => {
  it("allows resend for active viewer with deliverable email", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"]
    });
    const fields = getAdminUserEmailVerificationResendFields(user);
    expect(fields.resendEmailVerificationAvailable).toBe(true);
    expect(fields.resendEmailVerificationBlockedReason).toBeNull();
    expect(assertUserEligibleForEmailVerificationResend(user)).toBeNull();
  });

  it("blocks when user has no login role", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: []
    });
    expect(getAdminUserEmailVerificationResendFields(user).resendEmailVerificationAvailable).toBe(false);
    expect(assertUserEligibleForEmailVerificationResend(user)).toMatch(/no login role/i);
  });

  it("blocks when user is suspended", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"],
      status: "suspended"
    });
    expect(getAdminUserEmailVerificationResendFields(user).resendEmailVerificationAvailable).toBe(false);
    expect(assertUserEligibleForEmailVerificationResend(user)).toMatch(/suspended/i);
  });

  it("blocks X placeholder email", () => {
    const user = coreUser({
      email: "xlogin-123@x.oauth.local",
      roles: ["viewer"]
    });
    expect(getAdminUserEmailVerificationResendFields(user).resendEmailVerificationAvailable).toBe(false);
    expect(assertUserEligibleForEmailVerificationResend(user)).toMatch(/deliverable email/i);
  });
});
