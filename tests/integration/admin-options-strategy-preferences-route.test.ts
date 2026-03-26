import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminListOptionsStrategyPreferenceSummaries: vi.fn(),
  adminGetOptionsStrategyPreferenceById: vi.fn(),
  adminUpdateOptionsStrategyPreference: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => repoMocks);

import { GET as getOne, PATCH as patchOne } from "@/app/api/admin/options-strategy-preferences/[preferenceId]/route";
import { GET as listPrefs } from "@/app/api/admin/options-strategy-preferences/route";

const prefId = "507f1f77bcf86cd799439055";

function mockSummary() {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: new ObjectId(prefId),
    slug: "bull-call-debit-spread",
    name: "bull-call-debit-spread",
    sourceRelPath: "bull-call-debit-spread/bull-call-debit-spread.md",
    createdAt: now,
    updatedAt: now
  };
}

function mockFull() {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: new ObjectId(prefId),
    slug: "bull-call-debit-spread",
    name: "bull-call-debit-spread",
    description: "# Hello\n",
    sourceRelPath: "bull-call-debit-spread/bull-call-debit-spread.md",
    createdAt: now,
    updatedAt: now
  };
}

describe("/api/admin/options-strategy-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    repoMocks.adminListOptionsStrategyPreferenceSummaries.mockResolvedValue([mockSummary()]);
    repoMocks.adminGetOptionsStrategyPreferenceById.mockResolvedValue(mockFull());
    repoMocks.adminUpdateOptionsStrategyPreference.mockResolvedValue({
      ...mockFull(),
      name: "Updated",
      description: "# Patched\n"
    });
  });

  it("GET list returns summaries", async () => {
    const res = await listPrefs();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { slug: string }[] };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.slug).toBe("bull-call-debit-spread");
  });

  it("GET one returns full document", async () => {
    const res = await getOne(new Request("http://test"), { params: Promise.resolve({ preferenceId: prefId }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { description: string } };
    expect(json.data.description).toContain("Hello");
  });

  it("PATCH updates fields", async () => {
    const req = new Request(`http://test/api/admin/options-strategy-preferences/${prefId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated", description: "# Patched\n" })
    });
    const res = await patchOne(req, { params: Promise.resolve({ preferenceId: prefId }) });
    expect(res.status).toBe(200);
    expect(repoMocks.adminUpdateOptionsStrategyPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: prefId,
        patch: expect.objectContaining({ name: "Updated" })
      })
    );
  });

  it("rejects unauthenticated admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(NextResponse.json({ error: "nope" }, { status: 401 }));
    const res = await listPrefs();
    expect(res.status).toBe(401);
  });
});
