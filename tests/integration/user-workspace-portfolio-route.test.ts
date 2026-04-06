import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  listPortfoliosForSessionUser: vi.fn()
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    ...repositoryMocks
  };
});

import { POST as postWorkspacePortfolio } from "@/app/api/user/workspace-portfolio/route";

describe("POST /api/user/workspace-portfolio", () => {
  beforeEach(() => {
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["advisor"],
      email: "u@test.local",
      tenantRole: "member",
      xUserId: "x1",
      username: "u"
    });
    repositoryMocks.listPortfoliosForSessionUser.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        userId: "507f1f77bcf86cd799439011",
        name: "Book A",
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439044" },
        userId: "507f1f77bcf86cd799439011",
        name: "Book B",
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  });

  it("returns 401 when there is no session", async () => {
    sessionMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await postWorkspacePortfolio(
      new Request("http://localhost/api/user/workspace-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: "507f1f77bcf86cd799439044" })
      })
    );
    expect(res.status).toBe(401);
  });

  it("sets cookie when portfolio is owned", async () => {
    const res = await postWorkspacePortfolio(
      new Request("http://localhost/api/user/workspace-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: "507f1f77bcf86cd799439044" })
      })
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok?: boolean };
    expect(payload.ok).toBe(true);
    expect(res.cookies.get("xf_workspace_portfolio_id")?.value).toBe("507f1f77bcf86cd799439044");
  });

  it("accepts uppercase hex portfolioId and sets lowercase cookie", async () => {
    const res = await postWorkspacePortfolio(
      new Request("http://localhost/api/user/workspace-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: "507F1F77BCF86CD799439044" })
      })
    );
    expect(res.status).toBe(200);
    expect(res.cookies.get("xf_workspace_portfolio_id")?.value).toBe("507f1f77bcf86cd799439044");
  });

  it("returns 404 when portfolio is not in the user list", async () => {
    const res = await postWorkspacePortfolio(
      new Request("http://localhost/api/user/workspace-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId: "507f1f77bcf86cd799439099" })
      })
    );
    expect(res.status).toBe(404);
  });
});
