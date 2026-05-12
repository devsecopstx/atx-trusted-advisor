import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const findOne = vi.hoisted(() => vi.fn());

const workspaceMocks = vi.hoisted(() => ({
  loadWorkspaceSnapshotPreload: vi.fn(),
  buildWorkspacePreloadHintForSystemPrompt: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn(async () => ({
    collection: () => ({ findOne: findOne })
  }))
}));

vi.mock("@/modules/xchat/workspace-snapshot-for-prompt", async () => {
  const actual = await vi.importActual<typeof import("@/modules/xchat/workspace-snapshot-for-prompt")>(
    "@/modules/xchat/workspace-snapshot-for-prompt"
  );
  return {
    ...actual,
    loadWorkspaceSnapshotPreload: workspaceMocks.loadWorkspaceSnapshotPreload,
    buildWorkspacePreloadHintForSystemPrompt: workspaceMocks.buildWorkspacePreloadHintForSystemPrompt
  };
});

import { GET } from "@/app/api/app-user/xchat/prompt-template-v21/[slug]/route";
import { HNWI_DESK_REPORT_V21_TITLE } from "@/modules/xchat/xchat-hnwi-v21-desk-report";

describe("/api/app-user/xchat/prompt-template-v21/{slug}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    findOne.mockResolvedValue(null);
    workspaceMocks.loadWorkspaceSnapshotPreload.mockResolvedValue({
      promptJson: {
        loadedAt: "2026-05-01T12:00:00.000Z",
        workspaceContentRev: 0,
        portfolio: { id: "507f1f77bcf86cd799439033", name: "Seed" },
        accounts: [],
        positions: [],
        watchlist: { error: "no_watchlist" as const }
      },
      positionsFull: [{ symbol: "TSLA", qty: 10, avgCost: 200, accountId: "acc1" }]
    });
    workspaceMocks.buildWorkspacePreloadHintForSystemPrompt.mockReturnValue(
      "| Symbol | Qty | Avg cost |\n|--------|-----|----------|\n| TSLA | 10 | 200 |\n"
    );
  });

  it("returns composer text with Desk Report v2.1 marker and markdown table", async () => {
    const res = await GET(new Request("http://test/api/app-user/xchat/prompt-template-v21/hnwi-v21-wheel-cc"), {
      params: Promise.resolve({ slug: "hnwi-v21-wheel-cc" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { composerText?: string } };
    expect(body.data?.composerText).toBeDefined();
    const text = body.data?.composerText ?? "";
    expect(text).toContain(HNWI_DESK_REPORT_V21_TITLE);
    expect(text).toContain("|");
    expect(text).toContain("TSLA");
  });

  it("returns 400 for unknown slug", async () => {
    const res = await GET(new Request("http://test/api/app-user/xchat/prompt-template-v21/not-a-slug"), {
      params: Promise.resolve({ slug: "not-a-slug" })
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 when session missing", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(new Request("http://test/api/app-user/xchat/prompt-template-v21/hnwi-v21-wheel-cc"), {
      params: Promise.resolve({ slug: "hnwi-v21-wheel-cc" })
    });
    expect(res.status).toBe(401);
  });
});
