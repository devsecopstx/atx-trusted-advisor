import { afterEach, describe, expect, it, vi } from "vitest";

import {
    assertUserEligibleForCredentialInviteResend,
    getAdminUserCredentialInviteFields
} from "@/lib/admin-user-credential-invite";
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

describe("admin-user-credential-invite", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows resend for active viewer without password and deliverable email", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"]
    });
    const fields = getAdminUserCredentialInviteFields(user);
    expect(fields.hasPassword).toBe(false);
    expect(fields.resendPasswordInviteAvailable).toBe(true);
    expect(fields.resendPasswordInviteBlockedReason).toBeNull();
    expect(assertUserEligibleForCredentialInviteResend(user)).toBeNull();
  });

  it("blocks when ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY is set", () => {
    vi.stubEnv("ACCESS_APPROVAL_EMAIL_SIGN_IN_ONLY", "true");
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"]
    });
    const fields = getAdminUserCredentialInviteFields(user);
    expect(fields.resendPasswordInviteAvailable).toBe(false);
    expect(fields.resendPasswordInviteBlockedReason).toMatch(/SIGN_IN_ONLY/i);
    expect(fields.resendPasswordInviteForceAvailable).toBe(false);
    expect(assertUserEligibleForCredentialInviteResend(user)).toMatch(/SIGN_IN_ONLY/i);
  });

  it("blocks when user already has password", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"],
      passwordHash: "hashed"
    });
    const fields = getAdminUserCredentialInviteFields(user);
    expect(fields.hasPassword).toBe(true);
    expect(fields.resendPasswordInviteAvailable).toBe(false);
    expect(fields.resendPasswordInviteForceAvailable).toBe(true);
    expect(fields.resendPasswordInviteForceBlockedReason).toBeNull();
    expect(assertUserEligibleForCredentialInviteResend(user)).toMatch(/already has a password/i);
  });

  it("blocks when user has no login role", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: []
    });
    expect(getAdminUserCredentialInviteFields(user).resendPasswordInviteAvailable).toBe(false);
    expect(assertUserEligibleForCredentialInviteResend(user)).toMatch(/no login role/i);
  });

  it("blocks when user is suspended", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"],
      status: "suspended"
    });
    expect(getAdminUserCredentialInviteFields(user).resendPasswordInviteAvailable).toBe(false);
    expect(assertUserEligibleForCredentialInviteResend(user)).toMatch(/suspended/i);
  });

  it("exposes no force path when user has no password", () => {
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"]
    });
    const fields = getAdminUserCredentialInviteFields(user);
    expect(fields.resendPasswordInviteForceAvailable).toBe(false);
    expect(fields.resendPasswordInviteForceBlockedReason).toBeNull();
  });

  it("blocks X placeholder email (no deliverable inbox on core row)", () => {
    const user = coreUser({
      email: "xlogin-123@x.oauth.local",
      roles: ["viewer"]
    });
    expect(getAdminUserCredentialInviteFields(user).resendPasswordInviteAvailable).toBe(false);
    expect(assertUserEligibleForCredentialInviteResend(user)).toMatch(/deliverable email/i);
  });

  it("exposes credentialInviteExpiresAt when present", () => {
    const exp = new Date("2027-01-15T12:00:00.000Z");
    const user = coreUser({
      email: "real@example.com",
      roles: ["viewer"],
      credentialInviteExpiresAt: exp
    });
    expect(getAdminUserCredentialInviteFields(user).credentialInviteExpiresAt).toBe(
      "2027-01-15T12:00:00.000Z"
    );
  });
});
