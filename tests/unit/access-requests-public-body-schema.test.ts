import { describe, expect, it } from "vitest";

import { guestAccessRequestSchema } from "@/app/api/access-requests/public/route";

describe("guestAccessRequestSchema (POST /api/access-requests/public)", () => {
  const validBase = {
    name: "ValidUser1",
    email: "user@example.com",
    password: "twelvecharsxx",
    requestedPlan: "basic"
  };

  it("accepts a full valid payload", () => {
    const r = guestAccessRequestSchema.safeParse(validBase);
    expect(r.success).toBe(true);
  });

  it("rejects password shorter than 12 characters", () => {
    const r = guestAccessRequestSchema.safeParse({ ...validBase, password: "short" });
    expect(r.success).toBe(false);
  });

  it("requires password", () => {
    const r = guestAccessRequestSchema.safeParse({
      name: validBase.name,
      email: validBase.email,
      requestedPlan: validBase.requestedPlan
    });
    expect(r.success).toBe(false);
  });

  it("allows optional requestedPlan omission (defaults handled in route)", () => {
    const r = guestAccessRequestSchema.safeParse({
      name: validBase.name,
      email: validBase.email,
      password: validBase.password
    });
    expect(r.success).toBe(true);
  });
});
