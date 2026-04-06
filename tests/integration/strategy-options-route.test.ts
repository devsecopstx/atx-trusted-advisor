import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const { mockOptions, mockQuote } = vi.hoisted(() => ({
  mockOptions: vi.fn(),
  mockQuote: vi.fn()
}));

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
    // Keep strategy-options tests hermetic regardless of ATXFINANCE_BACKEND_ORIGIN in shell env.
    proxyStrategyOptionsRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockImplementation(() => ({
    options: mockOptions,
    quote: mockQuote
  }))
}));

import { GET as getStrategyOptions } from "@/app/api/strategy-options/route";

function makeYahooOptionGroup(expirationDate: Date, strikes: number[] = [250, 255, 260]) {
  const yyymmdd = expirationDate.toISOString().slice(0, 10).replace(/-/g, "").slice(2);
  const calls = strikes.map((strike) => ({
    contractSymbol: `TSLA${yyymmdd}C${String(Math.round(strike * 1000)).padStart(8, "0")}`,
    strike,
    lastPrice: 5.5,
    bid: 5.4,
    ask: 5.6,
    volume: 100,
    openInterest: 500,
    impliedVolatility: 0.35,
    expiration: expirationDate
  }));
  const puts = strikes.map((strike) => ({
    contractSymbol: `TSLA${yyymmdd}P${String(Math.round(strike * 1000)).padStart(8, "0")}`,
    strike,
    lastPrice: 4.2,
    bid: 4.1,
    ask: 4.3,
    volume: 80,
    openInterest: 400,
    impliedVolatility: 0.38,
    expiration: expirationDate
  }));
  return { expirationDate, calls, puts };
}

describe("GET /api/strategy-options", () => {
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
    mockQuote.mockResolvedValue({ regularMarketPrice: 255 });
  });

  it("returns 401 when session is missing", async () => {
    sessionMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await getStrategyOptions(
      new Request("http://localhost/api/strategy-options?underlying=TSLA&expiration=2026-02-27&strike=250")
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when underlying is missing", async () => {
    const res = await getStrategyOptions(
      new Request("http://localhost/api/strategy-options?expiration=2026-02-27&strike=250")
    );
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toBe("underlying is required");
  });

  it("returns 400 when expiration is missing", async () => {
    const res = await getStrategyOptions(
      new Request("http://localhost/api/strategy-options?underlying=TSLA&strike=250")
    );
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toBe("expiration is required");
  });

  it("returns 400 when underlying is malformed", async () => {
    const longSym = "A".repeat(40);
    const res = await getStrategyOptions(
      new Request(`http://localhost/api/strategy-options?underlying=${longSym}&expiration=2026-02-27&strike=250`)
    );
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toBe("underlying is too long");
  });

  it("returns 400 when expiration is not a valid normalized date", async () => {
    const res = await getStrategyOptions(
      new Request("http://localhost/api/strategy-options?underlying=TSLA&expiration=not-a-date&strike=250")
    );
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toContain("expiration");
  });

  it("returns 400 when strike is not a finite number", async () => {
    const res = await getStrategyOptions(
      new Request("http://localhost/api/strategy-options?underlying=TSLA&expiration=2026-02-27&strike=nan")
    );
    const data = (await res.json()) as { error: string };
    expect(res.status).toBe(400);
    expect(data.error).toBe("strike must be a non-negative number");
  });

  it("accepts Yahoo-style Unix timestamp for expiration", async () => {
    const unixTs = "1771545600";
    const expDate = "2026-02-20";
    const group = makeYahooOptionGroup(new Date(`${expDate}T00:00:00Z`));

    mockOptions.mockResolvedValueOnce({
      options: [group]
    });

    const res = await getStrategyOptions(
      new Request(
        `http://localhost/api/strategy-options?underlying=CIFR&expiration=${unixTs}&strike=10`
      )
    );
    const data = (await res.json()) as {
      expiration: string;
      requestedExpiration: string;
      dataSource: string;
    };

    expect(res.status).toBe(200);
    expect(data.expiration).toBe(expDate);
    expect(data.requestedExpiration).toBe(expDate);
    expect(data.dataSource).toBe("yahoo");
  });

  it("returns exact expiration when Yahoo has matching date", async () => {
    const requestedExp = "2026-02-27";
    const group = makeYahooOptionGroup(new Date(`${requestedExp}T12:00:00Z`));

    mockOptions.mockResolvedValueOnce({
      options: [group]
    });

    const res = await getStrategyOptions(
      new Request(
        `http://localhost/api/strategy-options?underlying=TSLA&expiration=${requestedExp}&strike=250`
      )
    );
    const data = (await res.json()) as { expiration: string; note: string; dataSource: string };

    expect(res.status).toBe(200);
    expect(data.expiration).toBe(requestedExp);
    expect(data.dataSource).toBe("yahoo");
    expect(data.note).not.toContain("closest to requested");
  });

  it("prefers exact match when multiple expirations exist", async () => {
    const requestedExp = "2026-02-27";
    const jan30 = makeYahooOptionGroup(new Date("2026-01-30T12:00:00Z"));
    const feb27 = makeYahooOptionGroup(new Date("2026-02-27T12:00:00Z"));
    const mar6 = makeYahooOptionGroup(new Date("2026-03-06T12:00:00Z"));

    mockOptions.mockResolvedValueOnce({
      options: [jan30, feb27, mar6]
    });

    const res = await getStrategyOptions(
      new Request(
        `http://localhost/api/strategy-options?underlying=TSLA&expiration=${requestedExp}&strike=250`
      )
    );
    const data = (await res.json()) as { expiration: string };

    expect(res.status).toBe(200);
    expect(data.expiration).toBe("2026-02-27");
  });

  it("falls back to synthetic when Yahoo returns empty", async () => {
    mockOptions.mockResolvedValueOnce({ options: [] });

    const res = await getStrategyOptions(
      new Request(
        "http://localhost/api/strategy-options?underlying=TSLA&expiration=2026-02-27&strike=250"
      )
    );
    const data = (await res.json()) as { dataSource: string; optionChain: unknown[] };

    expect(res.status).toBe(200);
    expect(data.dataSource).toBe("synthetic");
    expect(data.optionChain.length).toBeGreaterThan(0);
  });

  it("falls back to synthetic when Yahoo throws", async () => {
    mockOptions.mockRejectedValueOnce(new Error("Rate limited"));

    const res = await getStrategyOptions(
      new Request(
        "http://localhost/api/strategy-options?underlying=TSLA&expiration=2026-02-27&strike=250"
      )
    );
    const data = (await res.json()) as { dataSource: string; optionChain: unknown[] };

    expect(res.status).toBe(200);
    expect(data.dataSource).toBe("synthetic");
    expect(data.optionChain.length).toBeGreaterThan(0);
  });
});
