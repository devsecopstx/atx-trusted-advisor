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
import { brokerImportDryRunResponseSchema } from "@/modules/portfolio-import/broker-import-dry-run-schema";

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
    const raw: unknown = await response.json();
    const payload = brokerImportDryRunResponseSchema.parse(raw);
    expect(payload.broker).toBe("merrill");
    expect(payload.accounts[0]?.accountRef).toBe("51X-98940");
    expect(payload.accounts[0]?.stockCount).toBe(1);
    expect(payload.accounts[0]?.estimatedBalanceUsd).toBeGreaterThanOrEqual(0);
    expect(payload.csvStats.nonEmptyLines).toBeGreaterThanOrEqual(2);
    expect(payload.csvStats.totalPositionsParsed).toBe(1);
    expect(payload.sampleRows.length).toBeGreaterThanOrEqual(1);
    expect(payload.sampleRows[0]?.symbol).toMatch(/TSLA/i);
    expect(payload.previewWarnings).toEqual([]);
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
