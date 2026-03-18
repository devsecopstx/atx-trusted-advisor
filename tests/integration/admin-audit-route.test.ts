import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  listAuditEvents: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import { GET as getAuditEvents } from "@/app/api/admin/audit/route";

describe("admin audit route", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    auditMocks.listAuditEvents.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        entityType: "xpersona",
        entityId: "507f1f77bcf86cd799439044",
        action: "updated",
        actor: {
          userId: "507f1f77bcf86cd799439011",
          email: "admin@atxfinance.ai"
        },
        details: { changedFields: ["systemPrompt"] },
        createdAt: new Date("2026-03-16T00:00:00.000Z")
      }
    ]);
  });

  it("lists audit events with filters", async () => {
    const response = await getAuditEvents(
      new Request(
        "http://test/api/admin/audit?entityType=xpersona&action=updated&actor=admin&limit=25"
      )
    );
    const payload = (await response.json()) as { data: Array<{ action: string }> };

    expect(response.status).toBe(200);
    expect(payload.data[0]?.action).toBe("updated");
    expect(auditMocks.listAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "xpersona",
        action: "updated",
        actor: "admin",
        limit: 25
      })
    );
  });

  it("returns auth response for non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );

    const response = await getAuditEvents(new Request("http://test/api/admin/audit"));
    expect(response.status).toBe(403);
  });
});
