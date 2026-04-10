import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserXfUiThemePreferenceForHex: vi.fn(),
  updateCoreUserXfUiThemePreference: vi.fn()
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getCoreUserXfUiThemePreferenceForHex: identityMocks.getCoreUserXfUiThemePreferenceForHex,
    updateCoreUserXfUiThemePreference: identityMocks.updateCoreUserXfUiThemePreference
  };
});

import { GET as getAppearance, PATCH as patchAppearance } from "@/app/api/user/appearance/route";

describe("/api/user/appearance", () => {
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
    identityMocks.getCoreUserXfUiThemePreferenceForHex.mockResolvedValue(undefined);
    identityMocks.updateCoreUserXfUiThemePreference.mockResolvedValue(true);
  });

  it("GET returns null when user has no saved theme", async () => {
    const res = await getAppearance();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { xfUiTheme: string | null } };
    expect(body.data.xfUiTheme).toBeNull();
  });

  it("GET returns stored theme", async () => {
    identityMocks.getCoreUserXfUiThemePreferenceForHex.mockResolvedValue("light");
    const res = await getAppearance();
    const body = (await res.json()) as { data: { xfUiTheme: string | null } };
    expect(body.data.xfUiTheme).toBe("light");
  });

  it("PATCH persists theme", async () => {
    const res = await patchAppearance(
      new Request("http://localhost/api/user/appearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xfUiTheme: "system" })
      })
    );
    expect(res.status).toBe(200);
    expect(identityMocks.updateCoreUserXfUiThemePreference).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      "system"
    );
  });

  it("PATCH 400 on invalid body", async () => {
    const res = await patchAppearance(
      new Request("http://localhost/api/user/appearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xfUiTheme: "neon" })
      })
    );
    expect(res.status).toBe(400);
  });

  it("GET 401 when unauthenticated", async () => {
    sessionMocks.requireSessionUser.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const res = await getAppearance();
    expect(res.status).toBe(401);
  });
});
