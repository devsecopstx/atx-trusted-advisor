import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const slackMocks = vi.hoisted(() => ({
  sendSlackNotification: vi.fn(),
  buildUserFeedbackNotification: vi.fn(() => ({ text: "stub" }))
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/slack", () => slackMocks);

import { POST as postFeedback } from "@/app/api/feedback/route";

describe("POST /api/feedback", () => {
  beforeEach(() => {
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      email: "user@example.com",
      username: "tester",
      roles: ["viewer"],
      tenantId: "507f1f77bcf86cd799439033",
      tenantRole: "member",
      xUserId: "x-1"
    });
    slackMocks.sendSlackNotification.mockResolvedValue(true);
    slackMocks.buildUserFeedbackNotification.mockReturnValue({ text: "x" });
  });

  it("returns 401 when unauthenticated", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await postFeedback(
      new Request("http://127.0.0.1/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello there feedback" })
      })
    );

    expect(res.status).toBe(401);
  });

  it("accepts feedback and triggers slack builder", async () => {
    const res = await postFeedback(
      new Request("http://127.0.0.1/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Great product so far", page: "xChat" })
      })
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { ok?: boolean };
    expect(json.ok).toBe(true);
    expect(slackMocks.buildUserFeedbackNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Great product so far",
        page: "xChat",
        userId: "507f1f77bcf86cd799439011"
      })
    );
    expect(slackMocks.sendSlackNotification).toHaveBeenCalled();
  });

  it("returns 400 for short message", async () => {
    const res = await postFeedback(
      new Request("http://127.0.0.1/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "no" })
      })
    );

    expect(res.status).toBe(400);
  });
});
