import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const mockOptions = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    // Keep expirations tests hermetic regardless of ATXFINANCE_BACKEND_ORIGIN in shell env.
    proxyRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});

vi.mock("@/modules/yahoo/yahoo-finance-service", () => ({
  getYahooFinance2: () => ({
    options: mockOptions
  })
}));

import { GET as getExpirations } from "@/app/api/strategy-options/expirations/route";

describe("GET /api/strategy-options/expirations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"],
      email: "u@test.local",
      tenantRole: "tenant_member",
      xUserId: "x1",
      username: "user1"
    });
  });

  it("returns 401 when session is missing", async () => {
    sessionMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await getExpirations(new Request("http://test/api/strategy-options/expirations?underlying=TSLA"));
    expect(res.status).toBe(401);
  });

  it("returns 400 without underlying", async () => {
    const res = await getExpirations(new Request("http://test/api/strategy-options/expirations"));
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toBe("underlying is required");
  });

  it("returns 400 when underlying is too long", async () => {
    const res = await getExpirations(
      new Request(`http://test/api/strategy-options/expirations?underlying=${"X".repeat(50)}`)
    );
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toBe("underlying is too long");
  });

  it("returns normalized expiration dates", async () => {
    mockOptions.mockResolvedValueOnce({
      expirationDates: [new Date("2026-03-20T00:00:00.000Z"), new Date("2026-03-27T00:00:00.000Z")]
    });

    const res = await getExpirations(
      new Request("http://test/api/strategy-options/expirations?underlying=TSLA")
    );
    const data = (await res.json()) as { underlying: string; expirationDates: string[] };

    expect(res.status).toBe(200);
    expect(data.underlying).toBe("TSLA");
    expect(data.expirationDates).toEqual(["2026-03-20", "2026-03-27"]);
  });

  it("returns 200 with fallback future expirations when provider has no options data", async () => {
    mockOptions.mockRejectedValueOnce(new Error("No options found for underlying"));

    const res = await getExpirations(
      new Request("http://test/api/strategy-options/expirations?underlying=RDW")
    );
    const data = (await res.json()) as { underlying: string; expirationDates: string[] };

    expect(res.status).toBe(200);
    expect(data.underlying).toBe("RDW");
    expect(data.expirationDates.length).toBeGreaterThan(0);
    expect(data.expirationDates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
  });
});
