import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn()
}));

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  })
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("next/navigation", () => navigationMocks);

import AdminXchatPage from "@/app/admin/xchat/page";

describe("admin xchat page access", () => {
  beforeEach(() => {
    authMocks.getSessionUser.mockReset();
    navigationMocks.redirect.mockClear();
  });

  it("redirects unauthenticated users to /login", async () => {
    authMocks.getSessionUser.mockResolvedValue(null);

    await expect(AdminXchatPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-admin users to /xchat", async () => {
    authMocks.getSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      roles: ["viewer"]
    });

    await expect(AdminXchatPage()).rejects.toThrow("REDIRECT:/xchat");
  });
});
