import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireAdminTenantIdHex: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn()
}));

const marketingRepoMocks = vi.hoisted(() => ({
  listMarketingTemplates: vi.fn(),
  listMarketingSchedules: vi.fn(),
  createMarketingSchedule: vi.fn(),
  createMarketingTemplate: vi.fn(),
  getMarketingScheduleById: vi.fn(),
  getMarketingTemplateById: vi.fn(),
  updateMarketingTemplate: vi.fn(),
  deleteMarketingTemplate: vi.fn()
}));

const taskRunnerMocks = vi.hoisted(() => ({
  executeScheduledTask: vi.fn()
}));

const marketingXchatMocks = vi.hoisted(() => ({
  generateMarketingMarkdownWithXchat: vi.fn()
}));

const marketingPublisherMocks = vi.hoisted(() => ({
  publishMarketingTextToX: vi.fn()
}));

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAdminSession: authMocks.requireAdminSession,
    requireAdminTenantIdHex: authMocks.requireAdminTenantIdHex
  };
});

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getTenantByHexId: identityMocks.getTenantByHexId
  };
});

vi.mock("@/modules/marketing/repository", () => marketingRepoMocks);
vi.mock("@/modules/core-admin/task-runner", () => taskRunnerMocks);
vi.mock("@/modules/marketing/xchat-markdown", () => marketingXchatMocks);
vi.mock("@/modules/marketing/publisher", () => marketingPublisherMocks);

import { POST as postMarketingPreview } from "@/app/api/admin/marketing/preview/route";
import { POST as postMarketingRunNow } from "@/app/api/admin/marketing/schedules/[scheduleId]/run-now/route";
import { POST as postMarketingSchedule } from "@/app/api/admin/marketing/schedules/route";
import {
    DELETE as deleteMarketingTemplateById,
    PATCH as patchMarketingTemplateById
} from "@/app/api/admin/marketing/templates/[templateId]/route";
import {
    GET as getMarketingTemplates,
    POST as postMarketingTemplates
} from "@/app/api/admin/marketing/templates/route";
import { POST as postMarketingTestPostX } from "@/app/api/admin/marketing/test-post-x/route";

describe("admin marketing routes", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      email: "admin@example.com",
      username: "admin-user",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    authMocks.requireAdminTenantIdHex.mockResolvedValue("507f1f77bcf86cd799439022");
    identityMocks.getTenantByHexId.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439022" },
      slug: "atx",
      name: "aTx Finance"
    });
    marketingRepoMocks.listMarketingTemplates.mockResolvedValue([]);
    marketingRepoMocks.listMarketingSchedules.mockResolvedValue([]);
    marketingRepoMocks.createMarketingSchedule.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439090" },
      name: "Monday Pulse",
      category: "marketing_post",
      enabled: true,
      scheduleCron: "0 13 * * 1-5",
      config: {
        platforms: ["x"],
        destinationUrl: "https://fintech-advisor.ai",
        utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
      }
    });
    marketingRepoMocks.getMarketingScheduleById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439090" },
      name: "Monday Pulse",
      category: "marketing_post",
      enabled: true,
      scheduleCron: "0 13 * * 1-5",
      config: {
        platforms: ["x"],
        destinationUrl: "https://fintech-advisor.ai",
        utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
      }
    });
    marketingRepoMocks.getMarketingTemplateById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439050" },
      slug: "monday-market-pulse",
      name: "Monday Market Pulse",
      platforms: ["x"],
      contentTemplate: "Today is {{day_name}} and we are focused on {{market_pulse}}.",
      defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse" },
      disclaimerMode: "required"
    });
    marketingRepoMocks.updateMarketingTemplate.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439050" },
      slug: "monday-market-pulse",
      name: "Monday Market Pulse (Updated)",
      platforms: ["x", "linkedin"],
      contentTemplate: "Updated template content",
      defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse" },
      disclaimerMode: "required",
      estimatedEngagement: "high"
    });
    marketingRepoMocks.deleteMarketingTemplate.mockResolvedValue(true);
    marketingRepoMocks.createMarketingTemplate.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      slug: "custom-template",
      name: "Custom Template",
      platforms: ["x"],
      contentTemplate: "Hello {{date}}",
      defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse" },
      disclaimerMode: "required",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    taskRunnerMocks.executeScheduledTask.mockResolvedValue({
      runId: { toHexString: () => "507f1f77bcf86cd799439091" },
      status: "success",
      output: "ok"
    });
    marketingXchatMocks.generateMarketingMarkdownWithXchat.mockResolvedValue({
      markdown: "## Market Pulse\nDefined-risk ideas for this week.",
      model: "grok-4-1-fast-reasoning",
      personaName: "advisor"
    });
    marketingPublisherMocks.publishMarketingTextToX.mockResolvedValue(undefined);
  });

  it("blocks templates endpoint for non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await getMarketingTemplates();
    expect(response.status).toBe(403);
  });

  it("creates a marketing schedule with valid payload", async () => {
    const response = await postMarketingSchedule(
      new Request("http://localhost/api/admin/marketing/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Monday Pulse",
          enabled: true,
          systemWide: true,
          scheduleCron: "0 13 * * 1-5",
          config: {
            templateId: "507f1f77bcf86cd799439050",
            platforms: ["x"],
            destinationUrl: "https://fintech-advisor.ai",
            utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
          }
        })
      })
    );

    expect(response.status).toBe(201);
    expect(marketingRepoMocks.createMarketingSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Monday Pulse",
        systemWide: true,
        tenantId: undefined
      })
    );
  });

  it("rejects tenant-scoped schedule without tenantId", async () => {
    const response = await postMarketingSchedule(
      new Request("http://localhost/api/admin/marketing/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tenant Pulse",
          enabled: true,
          systemWide: false,
          scheduleCron: "0 13 * * 1-5",
          config: {
            templateId: "507f1f77bcf86cd799439050",
            platforms: ["x"],
            destinationUrl: "https://fintech-advisor.ai",
            utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
          }
        })
      })
    );
    expect(response.status).toBe(400);
    expect(marketingRepoMocks.createMarketingSchedule).not.toHaveBeenCalled();
  });

  it("creates a tenant-scoped marketing schedule when tenantId is valid", async () => {
    marketingRepoMocks.createMarketingSchedule.mockResolvedValueOnce({
      _id: { toHexString: () => "507f1f77bcf86cd799439091" },
      name: "Tenant Pulse",
      category: "marketing_post",
      enabled: true,
      tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
      scheduleCron: "0 13 * * 1",
      config: {
        platforms: ["x"],
        destinationUrl: "https://fintech-advisor.ai",
        utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
      }
    });
    const response = await postMarketingSchedule(
      new Request("http://localhost/api/admin/marketing/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tenant Pulse",
          enabled: true,
          systemWide: false,
          tenantId: "507f1f77bcf86cd799439022",
          scheduleCron: "0 13 * * 1",
          config: {
            templateId: "507f1f77bcf86cd799439050",
            platforms: ["x"],
            destinationUrl: "https://fintech-advisor.ai",
            utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
          }
        })
      })
    );
    expect(response.status).toBe(201);
    expect(identityMocks.getTenantByHexId).toHaveBeenCalledWith("507f1f77bcf86cd799439022");
    expect(marketingRepoMocks.createMarketingSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        systemWide: false,
        tenantId: "507f1f77bcf86cd799439022"
      })
    );
  });

  it("run-now tags scheduler trigger as marketing-scheduler", async () => {
    const response = await postMarketingRunNow(
      new Request("http://localhost/api/admin/marketing/schedules/507f1f77bcf86cd799439090/run-now", {
        method: "POST"
      }),
      { params: Promise.resolve({ scheduleId: "507f1f77bcf86cd799439090" }) }
    );

    expect(response.status).toBe(200);
    expect(taskRunnerMocks.executeScheduledTask).toHaveBeenCalledWith(
      expect.any(Object),
      "marketing-scheduler",
      expect.objectContaining({ username: "admin-user" }),
      { bypassMarketWindow: true }
    );
  });

  it("generates xchat markdown preview for marketing draft", async () => {
    const response = await postMarketingPreview(
      new Request("http://localhost/api/admin/marketing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: "507f1f77bcf86cd799439050",
          destinationUrl: "https://fintech-advisor.ai",
          platforms: ["x", "linkedin"],
          utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
        })
      })
    );
    expect(response.status).toBe(200);
    expect(marketingXchatMocks.generateMarketingMarkdownWithXchat).toHaveBeenCalledTimes(1);
  });

  it("creates a marketing template", async () => {
    const response = await postMarketingTemplates(
      new Request("http://localhost/api/admin/marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Custom Template",
          platforms: ["x"],
          contentTemplate: "Hello {{date}}",
          defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse", utm_medium: "owned-social" },
          estimatedEngagement: "medium"
        })
      })
    );
    expect(response.status).toBe(201);
    expect(marketingRepoMocks.createMarketingTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Custom Template",
        platforms: ["x"],
        contentTemplate: "Hello {{date}}",
        estimatedEngagement: "medium"
      })
    );
  });

  it("updates a marketing template", async () => {
    const response = await patchMarketingTemplateById(
      new Request("http://localhost/api/admin/marketing/templates/507f1f77bcf86cd799439050", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Monday Market Pulse (Updated)",
          platforms: ["x", "linkedin"],
          contentTemplate: "Updated template content",
          defaultUtm: { utm_source: "x", utm_campaign: "weekly-pulse" },
          estimatedEngagement: "high"
        })
      }),
      { params: Promise.resolve({ templateId: "507f1f77bcf86cd799439050" }) }
    );
    expect(response.status).toBe(200);
    expect(marketingRepoMocks.updateMarketingTemplate).toHaveBeenCalledTimes(1);
  });

  it("deletes a marketing template", async () => {
    const response = await deleteMarketingTemplateById(
      new Request("http://localhost/api/admin/marketing/templates/507f1f77bcf86cd799439050", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ templateId: "507f1f77bcf86cd799439050" }) }
    );
    expect(response.status).toBe(200);
    expect(marketingRepoMocks.deleteMarketingTemplate).toHaveBeenCalledTimes(1);
  });

  it("posts preview output to x for test delivery", async () => {
    const response = await postMarketingTestPostX(
      new Request("http://localhost/api/admin/marketing/test-post-x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postText: "Test post content\n\nhttps://fintech-advisor.ai?utm_source=x&utm_campaign=weekly-pulse"
        })
      })
    );
    expect(response.status).toBe(200);
    expect(marketingPublisherMocks.publishMarketingTextToX).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when x oauth posting is not configured", async () => {
    marketingPublisherMocks.publishMarketingTextToX.mockRejectedValueOnce(
      new Error(
        "Missing X OAuth for posting: use Admin → Marketing → Connect X for posting (OAuth), or set legacy X_OAUTH_REFRESH_TOKEN with X_OAUTH_CLIENT_ID / X_OAUTH_CLIENT_SECRET."
      )
    );
    const response = await postMarketingTestPostX(
      new Request("http://localhost/api/admin/marketing/test-post-x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postText: "hello"
        })
      })
    );
    expect(response.status).toBe(400);
  });
});
