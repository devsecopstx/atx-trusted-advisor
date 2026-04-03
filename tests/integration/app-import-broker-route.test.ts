import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  getPortfolioByIdForSessionUser: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    ...repositoryMocks
  };
});

import { POST as postAppBrokerImport } from "@/app/api/import/broker/route";

const MERRILL_HEADER = "Symbol,Quantity,Account #\n";

describe("POST /api/import/broker (app user)", () => {
  beforeEach(() => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"],
      email: "user@test.local",
      tenantRole: "member",
      xUserId: "x1",
      username: "appuser"
    });
    repositoryMocks.getPortfolioByIdForSessionUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439011",
      name: "Default Portfolio",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it("returns 401 when session is unauthenticated", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await postAppBrokerImport(
      new Request("http://test/api/import/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          broker: "merrill",
          exportType: "holdings",
          csv: `${MERRILL_HEADER}TSLA,10,51X-98940\n`,
          mappings: {},
          dryRun: true
        })
      })
    );
    expect(response.status).toBe(401);
  });

  it("returns preview for dryRun Merrill holdings CSV", async () => {
    const csv = `${MERRILL_HEADER}TSLA,10,51X-98940\n`;
    const response = await postAppBrokerImport(
      new Request("http://test/api/import/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          broker: "merrill",
          exportType: "holdings",
          csv,
          mappings: {},
          dryRun: true
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      dryRun: boolean;
      broker: string;
      accounts: Array<{ accountRef: string; stockCount: number }>;
    };
    expect(payload.dryRun).toBe(true);
    expect(payload.broker).toBe("merrill");
    expect(payload.accounts[0]?.accountRef).toBe("51X-98940");
    expect(payload.accounts[0]?.stockCount).toBe(1);
  });

  it("returns 404 when portfolio is not owned by session user", async () => {
    repositoryMocks.getPortfolioByIdForSessionUser.mockResolvedValue(null);
    const response = await postAppBrokerImport(
      new Request("http://test/api/import/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          broker: "merrill",
          exportType: "holdings",
          csv: `${MERRILL_HEADER}TSLA,10,51X-98940\n`,
          mappings: {},
          dryRun: true
        })
      })
    );
    expect(response.status).toBe(404);
  });
});
