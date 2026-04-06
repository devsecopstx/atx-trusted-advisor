import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  listDeployNoteConfigs: vi.fn(),
  createDeployNoteConfig: vi.fn(),
  getDeployNoteConfigById: vi.fn(),
  updateDeployNoteConfigById: vi.fn(),
  deleteDeployNoteConfigById: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    // Keep this integration suite hermetic (no live Spring proxy from env).
    proxyAdminUsersRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});
vi.mock("@/modules/core-admin/repository", () => repositoryMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import {
    DELETE as deleteConfig,
    GET as getConfigById,
    PUT as putConfig
} from "@/app/api/admin/deploy-note-configs/[configId]/route";
import { GET as getConfigs, POST as postConfig } from "@/app/api/admin/deploy-note-configs/route";

describe("admin deploy-note-config routes", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@atxfinance.ai",
      username: "admin"
    });
    repositoryMocks.listDeployNoteConfigs.mockResolvedValue([]);
    repositoryMocks.createDeployNoteConfig.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Prod Post-Deploy",
      environment: "production",
      enabled: true,
      includeRunUrl: true,
      includeActor: true,
      defaultDeploymentNotes: "Deployed release safely.",
      defaultHotfixNotes: "No hotfix required.",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    repositoryMocks.getDeployNoteConfigById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Prod Post-Deploy",
      environment: "production",
      enabled: true,
      includeRunUrl: true,
      includeActor: true,
      defaultDeploymentNotes: "Deployed release safely.",
      defaultHotfixNotes: "No hotfix required.",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T00:00:00.000Z")
    });
    repositoryMocks.updateDeployNoteConfigById.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Prod Hotfix",
      environment: "production",
      enabled: true,
      includeRunUrl: true,
      includeActor: true,
      defaultDeploymentNotes: "Release deployed.",
      defaultHotfixNotes: "Patch for env drift.",
      createdAt: new Date("2026-03-20T00:00:00.000Z"),
      updatedAt: new Date("2026-03-20T01:00:00.000Z")
    });
    repositoryMocks.deleteDeployNoteConfigById.mockResolvedValue(true);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("lists configs", async () => {
    const response = await getConfigs(
      new Request("http://test/api/admin/deploy-note-configs?environment=production")
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.listDeployNoteConfigs).toHaveBeenCalledWith({
      limit: 100,
      environment: "production",
      tenantId: "507f1f77bcf86cd799439022"
    });
  });

  it("creates config", async () => {
    const response = await postConfig(
      new Request("http://test/api/admin/deploy-note-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Prod Post-Deploy",
          environment: "production",
          enabled: true,
          includeRunUrl: true,
          includeActor: true
        })
      })
    );
    expect(response.status).toBe(201);
    expect(repositoryMocks.createDeployNoteConfig).toHaveBeenCalledTimes(1);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("gets config by id", async () => {
    const response = await getConfigById(new Request("http://test"), {
      params: Promise.resolve({ configId: "507f1f77bcf86cd799439099" })
    });
    expect(response.status).toBe(200);
  });

  it("updates config by id", async () => {
    const response = await putConfig(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Prod Hotfix", defaultHotfixNotes: "Patch for env drift." })
      }),
      { params: Promise.resolve({ configId: "507f1f77bcf86cd799439099" }) }
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.updateDeployNoteConfigById).toHaveBeenCalledTimes(1);
  });

  it("deletes config by id", async () => {
    const response = await deleteConfig(new Request("http://test"), {
      params: Promise.resolve({ configId: "507f1f77bcf86cd799439099" })
    });
    expect(response.status).toBe(200);
    expect(repositoryMocks.deleteDeployNoteConfigById).toHaveBeenCalledTimes(1);
  });

  it("returns auth response for non-admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await getConfigs(new Request("http://test/api/admin/deploy-note-configs"));
    expect(response.status).toBe(403);
  });
});
