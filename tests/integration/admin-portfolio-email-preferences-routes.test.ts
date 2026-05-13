import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireAdminTenantIdHex: vi.fn()
}));

const portfolioMocks = vi.hoisted(() => ({
  adminGetPortfolioById: vi.fn()
}));

const prefMocks = vi.hoisted(() => ({
  listPortfolioEmailPreferences: vi.fn(),
  upsertPortfolioEmailPreference: vi.fn()
}));

const tplMocks = vi.hoisted(() => ({
  findActiveEmailTemplate: vi.fn()
}));

const resolverMocks = vi.hoisted(() => ({
  resolveEffectiveEmailTemplate: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAdminSession: authMocks.requireAdminSession,
    requireAdminTenantIdHex: authMocks.requireAdminTenantIdHex
  };
});
vi.mock("@/modules/core-admin/repository", () => portfolioMocks);
vi.mock("@/modules/email-templates/portfolio-email-preferences-repository", () => prefMocks);
vi.mock("@/modules/email-templates/email-templates-repository", () => tplMocks);
vi.mock("@/modules/email-templates/email-template-resolver", () => resolverMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import {
    GET as getPrefs,
    PATCH as patchPrefs
} from "@/app/api/admin/portfolios/[portfolioId]/email-preferences/route";

const adminId = "507f1f77bcf86cd799439011";
const tenantId = "507f1f77bcf86cd799439022";
const portfolioIdHex = "507f1f77bcf86cd799439033";

describe("admin portfolio email-preferences routes", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: adminId,
      tenantId,
      roles: ["global_admin"],
      email: "admin@atxfinance.ai",
      username: "admin"
    });
    authMocks.requireAdminTenantIdHex.mockResolvedValue(tenantId);
    portfolioMocks.adminGetPortfolioById.mockResolvedValue({
      _id: new ObjectId(portfolioIdHex),
      tenantId: new ObjectId(tenantId),
      name: "Aurora",
      userId: "user-1",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    prefMocks.listPortfolioEmailPreferences.mockResolvedValue([]);
    prefMocks.upsertPortfolioEmailPreference.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd7994390a1"),
      tenantId: new ObjectId(tenantId),
      portfolioId: new ObjectId(portfolioIdHex),
      templateSlug: "portfolio-digest-weekly",
      enabled: true,
      cadenceOverride: "daily",
      subjectOverride: "x",
      bodyOverride: "y",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    tplMocks.findActiveEmailTemplate.mockResolvedValue(null);
    resolverMocks.resolveEffectiveEmailTemplate.mockResolvedValue(null);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("GET 400 when portfolioId is invalid", async () => {
    const response = await getPrefs(
      new Request("http://test/api/admin/portfolios/notvalid/email-preferences"),
      { params: Promise.resolve({ portfolioId: "notvalid" }) }
    );
    expect(response.status).toBe(400);
  });

  it("GET 404 when portfolio is missing", async () => {
    portfolioMocks.adminGetPortfolioById.mockResolvedValueOnce(null);
    const response = await getPrefs(
      new Request(`http://test/api/admin/portfolios/${portfolioIdHex}/email-preferences`),
      { params: Promise.resolve({ portfolioId: portfolioIdHex }) }
    );
    expect(response.status).toBe(404);
  });

  it("GET 403 when portfolio belongs to a different tenant", async () => {
    portfolioMocks.adminGetPortfolioById.mockResolvedValueOnce({
      _id: new ObjectId(portfolioIdHex),
      tenantId: new ObjectId("507f1f77bcf86cd799439088"),
      name: "Other",
      userId: "user-2",
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const response = await getPrefs(
      new Request(`http://test/api/admin/portfolios/${portfolioIdHex}/email-preferences`),
      { params: Promise.resolve({ portfolioId: portfolioIdHex }) }
    );
    expect(response.status).toBe(403);
  });

  it("GET 200 returns templates + preferences shape", async () => {
    const response = await getPrefs(
      new Request(`http://test/api/admin/portfolios/${portfolioIdHex}/email-preferences`),
      { params: Promise.resolve({ portfolioId: portfolioIdHex }) }
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.portfolioId).toBe(portfolioIdHex);
    expect(json.data.templates.length).toBeGreaterThan(0);
    expect(json.data.preferences).toEqual([]);
  });

  it("PATCH upserts a preference and writes audit event", async () => {
    const response = await patchPrefs(
      new Request(`http://test/api/admin/portfolios/${portfolioIdHex}/email-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateSlug: "portfolio-digest-weekly",
          enabled: true,
          cadenceOverride: "daily",
          subjectOverride: "x",
          bodyOverride: "y"
        })
      }),
      { params: Promise.resolve({ portfolioId: portfolioIdHex }) }
    );
    expect(response.status).toBe(200);
    expect(prefMocks.upsertPortfolioEmailPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        portfolioId: portfolioIdHex,
        patch: expect.objectContaining({ enabled: true })
      })
    );
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "portfolio_email_preference",
        action: "updated"
      })
    );
  });

  it("PATCH 400 on invalid payload", async () => {
    const response = await patchPrefs(
      new Request(`http://test/api/admin/portfolios/${portfolioIdHex}/email-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateSlug: "bogus-slug" })
      }),
      { params: Promise.resolve({ portfolioId: portfolioIdHex }) }
    );
    expect(response.status).toBe(400);
  });
});
