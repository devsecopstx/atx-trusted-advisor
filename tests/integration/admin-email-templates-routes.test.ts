import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireAdminTenantIdHex: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  listEmailTemplates: vi.fn(),
  createEmailTemplate: vi.fn(),
  getEmailTemplateBySlug: vi.fn(),
  updateEmailTemplate: vi.fn(),
  deleteEmailTemplate: vi.fn()
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
vi.mock("@/modules/email-templates/email-templates-repository", async () => {
  class EmailTemplateConflictError extends Error {
    readonly code = "email_template_conflict";
    constructor(message: string) {
      super(message);
      this.name = "EmailTemplateConflictError";
    }
  }
  return {
    ...repoMocks,
    EmailTemplateConflictError
  };
});
vi.mock("@/modules/audit/repository", () => auditMocks);

import {
    DELETE as deleteSlug,
    GET as getSlug,
    PATCH as patchSlug
} from "@/app/api/admin/email-templates/[slug]/route";
import { GET as getList, POST as postCreate } from "@/app/api/admin/email-templates/route";

const adminId = "507f1f77bcf86cd799439011";
const tenantId = "507f1f77bcf86cd799439022";

const fakeTemplate = {
  _id: new ObjectId("507f1f77bcf86cd7994390a1"),
  slug: "portfolio-digest-weekly" as const,
  version: "1.0",
  tenantId: null,
  subject: "subject",
  body: "# body",
  active: true,
  defaultCadence: "weekly" as const,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-13T00:00:00.000Z")
};

describe("admin email-templates routes", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: adminId,
      tenantId,
      roles: ["global_admin"],
      email: "admin@atxfinance.ai",
      username: "admin"
    });
    authMocks.requireAdminTenantIdHex.mockResolvedValue(tenantId);
    repoMocks.listEmailTemplates.mockResolvedValue([fakeTemplate]);
    repoMocks.createEmailTemplate.mockResolvedValue(fakeTemplate);
    repoMocks.getEmailTemplateBySlug.mockResolvedValue(fakeTemplate);
    repoMocks.updateEmailTemplate.mockResolvedValue(fakeTemplate);
    repoMocks.deleteEmailTemplate.mockResolvedValue(true);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("GET lists templates including global by default", async () => {
    const response = await getList(
      new Request("http://test/api/admin/email-templates?includeGlobal=true")
    );
    expect(response.status).toBe(200);
    expect(repoMocks.listEmailTemplates).toHaveBeenCalledWith({
      tenantId,
      includeGlobalDefaults: true
    });
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].slug).toBe("portfolio-digest-weekly");
  });

  it("POST creates a new template and writes audit event", async () => {
    const response = await postCreate(
      new Request("http://test/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "portfolio-digest-weekly",
          version: "1.0",
          tenantId: null,
          subject: "x",
          body: "# y",
          active: true,
          defaultCadence: "weekly"
        })
      })
    );
    expect(response.status).toBe(201);
    expect(repoMocks.createEmailTemplate).toHaveBeenCalled();
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "email_template",
        action: "created"
      })
    );
  });

  it("POST 400 on invalid payload", async () => {
    const response = await postCreate(
      new Request("http://test/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "not-a-real-slug" })
      })
    );
    expect(response.status).toBe(400);
  });

  it("POST 409 on slug conflict", async () => {
    const { EmailTemplateConflictError } = await import(
      "@/modules/email-templates/email-templates-repository"
    );
    repoMocks.createEmailTemplate.mockRejectedValueOnce(
      new EmailTemplateConflictError("dup")
    );
    const response = await postCreate(
      new Request("http://test/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "portfolio-digest-weekly",
          version: "1.0",
          tenantId: null,
          subject: "x",
          body: "# y",
          active: true,
          defaultCadence: "weekly"
        })
      })
    );
    expect(response.status).toBe(409);
  });

  it("GET /[slug] 404 for unknown slug", async () => {
    const response = await getSlug(
      new Request("http://test/api/admin/email-templates/unknown"),
      { params: Promise.resolve({ slug: "unknown" }) }
    );
    expect(response.status).toBe(404);
  });

  it("PATCH /[slug] updates the row at tenant scope by default", async () => {
    const response = await patchSlug(
      new Request("http://test/api/admin/email-templates/portfolio-digest-weekly", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "new subject" })
      }),
      { params: Promise.resolve({ slug: "portfolio-digest-weekly" }) }
    );
    expect(response.status).toBe(200);
    expect(repoMocks.updateEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "portfolio-digest-weekly",
        tenantId
      })
    );
  });

  it("PATCH /[slug]?scope=global writes against tenantId null", async () => {
    await patchSlug(
      new Request(
        "http://test/api/admin/email-templates/portfolio-digest-weekly?scope=global",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false })
        }
      ),
      { params: Promise.resolve({ slug: "portfolio-digest-weekly" }) }
    );
    expect(repoMocks.updateEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: null })
    );
  });

  it("DELETE /[slug] removes the row and audits", async () => {
    const response = await deleteSlug(
      new Request("http://test/api/admin/email-templates/portfolio-digest-weekly", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ slug: "portfolio-digest-weekly" }) }
    );
    expect(response.status).toBe(200);
    expect(repoMocks.deleteEmailTemplate).toHaveBeenCalled();
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deleted", entityType: "email_template" })
    );
  });
});
