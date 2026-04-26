import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  getCoreUserByEmail: vi.fn(),
  getCoreUserById: vi.fn()
}));

const credentialsMocks = vi.hoisted(() => ({
  issueEmailVerificationForUser: vi.fn(),
  completeEmailVerification: vi.fn()
}));

const welcomeMocks = vi.hoisted(() => ({
  sendWelcomeEmailIfConfigured: vi.fn()
}));

const emailMessageMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn()
}));

vi.mock("@/modules/identity/repository", () => repoMocks);
vi.mock("@/modules/identity/email-credentials-repository", () => credentialsMocks);
vi.mock("@/modules/identity/email-welcome", () => welcomeMocks);
vi.mock("@/lib/send-email-credential-messages", () => emailMessageMocks);

import { POST as postRequestVerification } from "@/app/api/auth/email/request-verification/route";
import { POST as postVerifyEmail } from "@/app/api/auth/email/verify/route";

describe("auth email verification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("request-verification returns ok and issues token when user exists", async () => {
    repoMocks.getCoreUserByEmail.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439011")
    });
    credentialsMocks.issueEmailVerificationForUser.mockResolvedValue({ rawToken: "tok_123" });
    emailMessageMocks.sendEmailVerificationEmail.mockResolvedValue(true);
    const res = await postRequestVerification(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" })
      })
    );
    expect(res.status).toBe(200);
    expect(credentialsMocks.issueEmailVerificationForUser).toHaveBeenCalledTimes(1);
    expect(emailMessageMocks.sendEmailVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("request-verification skips token issue for already-verified users", async () => {
    repoMocks.getCoreUserByEmail.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      emailVerifiedAt: new Date()
    });
    const res = await postRequestVerification(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" })
      })
    );
    expect(res.status).toBe(200);
    expect(credentialsMocks.issueEmailVerificationForUser).not.toHaveBeenCalled();
    expect(emailMessageMocks.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("verify marks token complete and sends welcome", async () => {
    credentialsMocks.completeEmailVerification.mockResolvedValue({
      ok: true,
      userId: new ObjectId("507f1f77bcf86cd799439011")
    });
    repoMocks.getCoreUserById.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439011"),
      email: "user@example.com"
    });
    const res = await postVerifyEmail(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "abcdefghijklmnopqrstuvwxyz123456" })
      })
    );
    expect(res.status).toBe(200);
    expect(welcomeMocks.sendWelcomeEmailIfConfigured).toHaveBeenCalledTimes(1);
  });
});
