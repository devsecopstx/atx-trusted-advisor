import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

import { POST } from "@/app/api/app-user/xchat/voice-transcribe/route";

describe("POST /api/app-user/xchat/voice-transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
  });

  it("normalizes transcript draft", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptDraft: " add   NVDA   to my watchlist  ",
          locale: "en-US"
        })
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { transcript: string; source: string } };
    expect(body.data.transcript).toBe("add NVDA to my watchlist");
    expect(body.data.source).toBe("browser_stt_mvp");
  });

  it("passes through unauthorized", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptDraft: "hello" })
      })
    );
    expect(res.status).toBe(401);
  });
});
