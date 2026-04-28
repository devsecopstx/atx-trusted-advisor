import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  requireAdminTenantIdHex: vi.fn()
}));

const marketingRepoMocks = vi.hoisted(() => ({
  listMarketingTemplates: vi.fn(),
  listMarketingSchedules: vi.fn(),
  createMarketingSchedule: vi.fn(),
  getMarketingScheduleById: vi.fn(),
  getMarketingTemplateById: vi.fn()
}));

const taskRunnerMocks = vi.hoisted(() => ({
  executeScheduledTask: vi.fn()
}));

const marketingXchatMocks = vi.hoisted(() => ({
  generateMarketingMarkdownWithXchat: vi.fn()
}));

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...actual,
    requireAdminSession: authMocks.requireAdminSession,
    requireAdminTenantIdHex: authMocks.requireAdminTenantIdHex
  };
});

vi.mock("@/modules/marketing/repository", () => marketingRepoMocks);
vi.mock("@/modules/core-admin/task-runner", () => taskRunnerMocks);
vi.mock("@/modules/marketing/xchat-markdown", () => marketingXchatMocks);

import { POST as postMarketingRunNow } from "@/app/api/admin/marketing/schedules/[scheduleId]/run-now/route";
import { POST as postMarketingPreview } from "@/app/api/admin/marketing/preview/route";
import { POST as postMarketingSchedule } from "@/app/api/admin/marketing/schedules/route";
import { GET as getMarketingTemplates } from "@/app/api/admin/marketing/templates/route";

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
        destinationUrl: "https://atx.fintech-advisor.ai",
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
        destinationUrl: "https://atx.fintech-advisor.ai",
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
          scheduleCron: "0 13 * * 1-5",
          config: {
            templateId: "507f1f77bcf86cd799439050",
            platforms: ["x"],
            destinationUrl: "https://atx.fintech-advisor.ai",
            utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
          }
        })
      })
    );

    expect(response.status).toBe(201);
    expect(marketingRepoMocks.createMarketingSchedule).toHaveBeenCalledTimes(1);
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
          destinationUrl: "https://atx.fintech-advisor.ai",
          platforms: ["x", "linkedin"],
          utmParams: { utm_source: "x", utm_campaign: "weekly-pulse" }
        })
      })
    );
    expect(response.status).toBe(200);
    expect(marketingXchatMocks.generateMarketingMarkdownWithXchat).toHaveBeenCalledTimes(1);
  });
});
