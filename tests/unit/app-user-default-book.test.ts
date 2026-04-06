import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  listPortfoliosForSessionUser: vi.fn(),
  listPortfolioAccounts: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", () => repo);
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined
  }))
}));

import { loadAppUserDefaultBookForPortfolioId, resolveChosenPortfolioId } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";

const session: SessionUser = {
  userId: "507f1f77bcf86cd799439011",
  email: "u@example.com",
  roles: ["viewer"],
  tenantId: "507f1f77bcf86cd799439022",
  tenantRole: "tenant_admin",
  xUserId: "x1",
  username: "user1"
};

describe("resolveChosenPortfolioId", () => {
  it("matches workspace cookie when hex is uppercase", () => {
    const id = "507f1f77bcf86cd7994390aa";
    const chosen = resolveChosenPortfolioId(
      [{ id, name: "P", isDefault: true }],
      id.toUpperCase()
    );
    expect(chosen).toBe(id);
  });
});

describe("loadAppUserDefaultBookForPortfolioId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when portfolio id is not in the user's workspace list", async () => {
    repo.listPortfoliosForSessionUser.mockResolvedValue([]);
    const r = await loadAppUserDefaultBookForPortfolioId(
      session,
      "507f1f77bcf86cd799439099"
    );
    expect(r).toBeNull();
    expect(repo.listPortfolioAccounts).not.toHaveBeenCalled();
  });

  it("returns null for invalid ObjectId hex", async () => {
    const r = await loadAppUserDefaultBookForPortfolioId(session, "not-valid");
    expect(r).toBeNull();
    expect(repo.listPortfoliosForSessionUser).not.toHaveBeenCalled();
  });

  it("loads accounts and portfolio name for an owned portfolio id", async () => {
    const pid = new ObjectId("507f1f77bcf86cd7994390aa");
    repo.listPortfoliosForSessionUser.mockResolvedValue([
      {
        _id: pid,
        name: "Pinned",
        isDefault: false
      }
    ]);
    repo.listPortfolioAccounts.mockResolvedValue([
      {
        _id: new ObjectId("507f1f77bcf86cd7994390bb"),
        name: "Main",
        type: "cash",
        extAccountId: "e",
        isDefault: true,
        cashBalance: 1000
      }
    ]);
    const r = await loadAppUserDefaultBookForPortfolioId(session, pid.toHexString());
    expect(r).not.toBeNull();
    expect(r?.portfolioId).toBe(pid.toHexString());
    expect(r?.portfolioName).toBe("Pinned");
    expect(r?.workspacePortfolios).toEqual([
      { id: pid.toHexString(), name: "Pinned", isDefault: false }
    ]);
    expect(repo.listPortfolioAccounts).toHaveBeenCalledWith({
      userId: session.userId,
      portfolioId: pid.toHexString(),
      tenantId: session.tenantId
    });
  });

  it("resolves owned portfolio when id hex uses uppercase (URL/case drift)", async () => {
    const pid = new ObjectId("507f1f77bcf86cd7994390aa");
    repo.listPortfoliosForSessionUser.mockResolvedValue([
      {
        _id: pid,
        name: "Pinned",
        isDefault: false
      }
    ]);
    repo.listPortfolioAccounts.mockResolvedValue([]);
    const upper = pid.toHexString().toUpperCase();
    const r = await loadAppUserDefaultBookForPortfolioId(session, upper);
    expect(r).not.toBeNull();
    expect(r?.portfolioId).toBe(pid.toHexString());
  });
});
