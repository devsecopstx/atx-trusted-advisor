import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

import { GET } from "@/app/api/admin/platform/data-plane-health/route";
import { summarizeBffRegisteredWriteHealth } from "@/lib/data-plane-write-health";

describe("GET /api/admin/platform/data-plane-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"]
    });
  });

  it("returns catalog + runtime + registered write rows", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        catalog: ReturnType<typeof summarizeBffRegisteredWriteHealth>;
        runtime: { backendOriginConfigured: boolean; bffProductPlaneGateActive: boolean };
        registeredWriteRows: { method: string; pathTemplate: string; disposition: string }[];
      };
    };
    const cat = body.data.catalog;
    expect(cat.bffRegisteredWritesTotal).toBeGreaterThan(0);
    expect(cat.springAuthoritativeWhenGateOn + cat.legacyNextRegisteredWrites).toBe(cat.bffRegisteredWritesTotal);
    expect(body.data.registeredWriteRows.length).toBe(cat.bffRegisteredWritesTotal);
    expect(typeof body.data.runtime.backendOriginConfigured).toBe("boolean");
    expect(typeof body.data.runtime.bffProductPlaneGateActive).toBe("boolean");
  });

  it("passes through forbidden response", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
