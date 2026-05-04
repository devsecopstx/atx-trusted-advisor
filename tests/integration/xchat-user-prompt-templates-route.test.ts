import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  listUserPromptTemplates: vi.fn(),
  insertUserPromptTemplate: vi.fn(),
  deleteUserPromptTemplate: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/mongodb", () => ({
  getDb: vi.fn()
}));
vi.mock("@/modules/xchat/xchat-user-prompt-templates-repository", () => repoMocks);

import { DELETE } from "@/app/api/app-user/xchat/prompt-templates/[id]/route";
import { GET, POST } from "@/app/api/app-user/xchat/prompt-templates/route";

describe("/api/app-user/xchat/prompt-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    repoMocks.listUserPromptTemplates.mockResolvedValue([
      {
        id: "507f1f77bcf86cd799439033",
        title: "My scan",
        subtitle: "Saved · you",
        prompt: "Review my book.",
        updatedAt: "2026-05-01T12:00:00.000Z"
      }
    ]);
    repoMocks.insertUserPromptTemplate.mockResolvedValue({
      ok: true,
      template: {
        id: "507f1f77bcf86cd799439044",
        title: "New",
        subtitle: "",
        prompt: "Hello",
        updatedAt: "2026-05-01T12:00:00.000Z"
      }
    });
    repoMocks.deleteUserPromptTemplate.mockResolvedValue(true);
  });

  it("GET lists templates for approved app user", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { templates: Array<{ id: string }> };
    };
    expect(body.data.templates).toHaveLength(1);
    expect(repoMocks.listUserPromptTemplates).toHaveBeenCalledTimes(1);
  });

  it("POST creates a template", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "T", prompt: "P" })
      })
    );
    expect(res.status).toBe(201);
    expect(repoMocks.insertUserPromptTemplate).toHaveBeenCalledTimes(1);
  });

  it("DELETE removes template by id", async () => {
    const res = await DELETE(new Request("http://test"), {
      params: Promise.resolve({ id: "507f1f77bcf86cd799439033" })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.deleteUserPromptTemplate).toHaveBeenCalledTimes(1);
  });

  it("returns 401 wrapper when session missing", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
