import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const sttMocks = vi.hoisted(() => ({
  transcribeAudioWithXaiStt: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/xai-stt", () => ({
  transcribeAudioWithXaiStt: sttMocks.transcribeAudioWithXaiStt
}));

import { POST } from "@/app/api/app-user/xchat/voice-transcribe/route";

describe("POST /api/app-user/xchat/voice-transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    sttMocks.transcribeAudioWithXaiStt.mockResolvedValue({
      text: "hello from xai",
      duration: 2.5
    });
  });

  it("transcribes multipart audio via xAI STT", async () => {
    const form = new FormData();
    form.set(
      "audio",
      new File([Buffer.from("fake-bytes")], "recording.webm", { type: "audio/webm" })
    );
    form.set("language", "en");
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        body: form
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { transcript: string; source: string; duration?: number };
    };
    expect(body.data.transcript).toBe("hello from xai");
    expect(body.data.source).toBe("xai_stt");
    expect(body.data.duration).toBe(2.5);
    expect(sttMocks.transcribeAudioWithXaiStt).toHaveBeenCalledTimes(1);
  });

  it("normalizes transcript draft (browser STT fallback JSON)", async () => {
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
    expect(body.data.source).toBe("browser_stt");
  });

  it("returns 503 when xAI STT fails", async () => {
    sttMocks.transcribeAudioWithXaiStt.mockRejectedValueOnce(new Error("upstream"));
    const form = new FormData();
    form.set(
      "audio",
      new File([Buffer.from("x")], "recording.webm", { type: "audio/webm" })
    );
    const res = await POST(new Request("http://test", { method: "POST", body: form }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("xai_stt_failed");
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
