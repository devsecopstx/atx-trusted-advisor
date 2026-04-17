import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const portfolioAccessMocks = vi.hoisted(() => ({
  requirePortfolioForSessionUser: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminGetPortfolioAlert: vi.fn()
}));

const xaiMocks = vi.hoisted(() => ({
  respondWithXai: vi.fn()
}));

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyPortfolioRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/lib/portfolio-access", () => portfolioAccessMocks);

vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    adminGetPortfolioAlert: repoMocks.adminGetPortfolioAlert
  };
});

vi.mock("@/lib/xai", () => ({
  respondWithXai: xaiMocks.respondWithXai
}));

import { POST as postAlertNarrative } from "@/app/api/portfolios/[portfolioId]/alerts/[alertId]/narrative/route";
import type { SessionUser } from "@/lib/auth";
import type { PortfolioAlert } from "@/modules/core-admin/types";

const portfolioHex = "507f1f77bcf86cd799439011";
const alertHex = "507f1f77bcf86cd7994390aa";

const baseSession: SessionUser = {
  userId: "user-narrative-test",
  email: "narrative@test.local",
  roles: ["advisor"],
  tenantId: "507f1f77bcf86cd799439022",
  tenantRole: "member",
  xUserId: "x1",
  username: "narrative_test"
};

function makeAlert(overrides: Partial<PortfolioAlert> = {}): PortfolioAlert {
  const now = new Date();
  return {
    _id: new ObjectId(alertHex),
    userId: baseSession.userId,
    portfolioId: new ObjectId(portfolioHex),
    title: "Option scanner: TEST",
    body: "[afp:TEST|2026-04-17|100|call]\n[close:BUY_TO_CLOSE]\n",
    severity: "warning",
    status: "active",
    symbol: "TEST",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("POST /api/portfolios/[portfolioId]/alerts/[alertId]/narrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.requireSessionUser.mockResolvedValue(baseSession);
    portfolioAccessMocks.requirePortfolioForSessionUser.mockResolvedValue(null);
  });

  it("returns 200 with trimmed narrative and model when xAI succeeds", async () => {
    repoMocks.adminGetPortfolioAlert.mockResolvedValue(makeAlert());
    xaiMocks.respondWithXai.mockResolvedValue({
      model: "grok-test-model",
      outputText: "  Desk summary paragraph.  "
    });

    const res = await postAlertNarrative(new Request("http://localhost/api", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: portfolioHex, alertId: alertHex })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { narrative: string; model: string };
    };
    expect(body.data.narrative).toBe("Desk summary paragraph.");
    expect(body.data.model).toBe("grok-test-model");
    expect(xaiMocks.respondWithXai).toHaveBeenCalledTimes(1);
    expect(repoMocks.adminGetPortfolioAlert).toHaveBeenCalledWith(portfolioHex, alertHex);
  });

  it("returns 404 when alert is missing", async () => {
    repoMocks.adminGetPortfolioAlert.mockResolvedValue(null);

    const res = await postAlertNarrative(new Request("http://localhost/api", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: portfolioHex, alertId: alertHex })
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Alert not found");
    expect(xaiMocks.respondWithXai).not.toHaveBeenCalled();
  });

  it("returns 503 narrative_unavailable when xAI throws", async () => {
    repoMocks.adminGetPortfolioAlert.mockResolvedValue(makeAlert());
    xaiMocks.respondWithXai.mockRejectedValue(new Error("provider down"));

    const res = await postAlertNarrative(new Request("http://localhost/api", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: portfolioHex, alertId: alertHex })
    });

    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("narrative_unavailable");
    expect(body.error).toContain("unavailable");
  });

  it("returns session gate when requireSessionUser denies", async () => {
    sessionMocks.requireSessionUser.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await postAlertNarrative(new Request("http://localhost/api", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: portfolioHex, alertId: alertHex })
    });

    expect(res.status).toBe(401);
    expect(repoMocks.adminGetPortfolioAlert).not.toHaveBeenCalled();
  });
});
