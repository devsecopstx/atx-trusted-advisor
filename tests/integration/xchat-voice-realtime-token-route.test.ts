import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const vrMocks = vi.hoisted(() => ({
  createXaiRealtimeClientSecret: vi.fn(),
  buildXaiRealtimeWsUrl: vi.fn()
}));

const wsSnapMocks = vi.hoisted(() => ({
  buildWorkspaceServerSnapshotBlock: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/xai-voice-realtime", () => ({
  createXaiRealtimeClientSecret: vrMocks.createXaiRealtimeClientSecret,
  buildXaiRealtimeWsUrl: vrMocks.buildXaiRealtimeWsUrl
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined as { value: string } | undefined
  }))
}));
vi.mock("@/modules/xchat/workspace-snapshot-for-prompt", () => ({
  buildWorkspaceServerSnapshotBlock: wsSnapMocks.buildWorkspaceServerSnapshotBlock
}));

import { POST } from "@/app/api/app-user/xchat/voice-realtime/token/route";

describe("POST /api/app-user/xchat/voice-realtime/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    vrMocks.createXaiRealtimeClientSecret.mockResolvedValue({
      value: "xai-realtime-client-secret-test",
      expires_at: 1_750_000_000
    });
    vrMocks.buildXaiRealtimeWsUrl.mockReturnValue(
      "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0"
    );
    wsSnapMocks.buildWorkspaceServerSnapshotBlock.mockResolvedValue(
      "Workspace block: portfolio + watchlist preview"
    );
  });

  it("returns ephemeral secret + ws url", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAfterSeconds: 120 })
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        client_secret: { value: string; expires_at: number };
        realtime_ws_url: string;
        model: string;
        workspace_voice_context?: string;
      };
    };
    expect(body.data.client_secret.value).toContain("xai-realtime-client-secret");
    expect(body.data.realtime_ws_url).toContain("wss://");
    expect(body.data.model).toBe("grok-voice-think-fast-1.0");
    expect(body.data.workspace_voice_context).toContain("Workspace block");
    expect(wsSnapMocks.buildWorkspaceServerSnapshotBlock).toHaveBeenCalled();
    expect(vrMocks.createXaiRealtimeClientSecret).toHaveBeenCalledWith(
      expect.objectContaining({ expiresSeconds: 120, model: "grok-voice-think-fast-1.0" })
    );
  });

  it("returns 503 when xAI token mint fails", async () => {
    vrMocks.createXaiRealtimeClientSecret.mockRejectedValueOnce(new Error("upstream"));
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("xai_realtime_token_failed");
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json"
      })
    );
    expect(res.status).toBe(400);
  });

  it("forwards legacy voice model to client_secret helper", async () => {
    vrMocks.buildXaiRealtimeWsUrl.mockReturnValueOnce(
      "wss://api.x.ai/v1/realtime?model=grok-voice-fast-1.0"
    );
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "grok-voice-fast-1.0", expiresAfterSeconds: 180 })
      })
    );
    expect(res.status).toBe(200);
    expect(vrMocks.createXaiRealtimeClientSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "grok-voice-fast-1.0",
        expiresSeconds: 180
      })
    );
    const body = (await res.json()) as { data?: { model?: string } };
    expect(body.data?.model).toBe("grok-voice-fast-1.0");
  });

  it("passes through unauthorized", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await POST(new Request("http://test", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });
});
