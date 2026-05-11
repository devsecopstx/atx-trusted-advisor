import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const cacheMocks = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn()
}));

const identityRepoMocks = vi.hoisted(() => ({
  resolveTenantIdHexForGlobalAdminConsole: vi.fn()
}));

const exportRepoMocks = vi.hoisted(() => ({
  ensureTenantExportJobIndexes: vi.fn(),
  insertTenantExportJob: vi.fn(),
  listTenantExportJobsForTenant: vi.fn(),
  getTenantExportJobById: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireGlobalAdminSession: authMocks.requireGlobalAdminSession
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: cacheMocks.getTenantByHexIdCached
}));

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    resolveTenantIdHexForGlobalAdminConsole: identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole
  };
});

vi.mock("@/modules/platform/tenant-admin-export-repository", () => ({
  ensureTenantExportJobIndexes: exportRepoMocks.ensureTenantExportJobIndexes,
  insertTenantExportJob: exportRepoMocks.insertTenantExportJob,
  listTenantExportJobsForTenant: exportRepoMocks.listTenantExportJobsForTenant,
  getTenantExportJobById: exportRepoMocks.getTenantExportJobById
}));

import { GET as GET_ARTIFACT } from "@/app/api/admin/tenants/[tenantId]/export-jobs/[jobId]/artifact/[kind]/route";
import { GET as GET_JOB } from "@/app/api/admin/tenants/[tenantId]/export-jobs/[jobId]/route";
import { GET as GET_LIST, POST as POST_ENQUEUE } from "@/app/api/admin/tenants/[tenantId]/export-jobs/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";

function baseTenant() {
  const id = new ObjectId(TENANT_HEX);
  return {
    _id: id,
    slug: "acme",
    name: "Acme",
    isDefault: false
  };
}

function adminSession() {
  return {
    userId: "507f1f77bcf86cd799439011",
    tenantId: TENANT_HEX,
    email: "admin@atxfinance.ai",
    username: "xf-admin",
    roles: ["global_admin"] as const,
    tenantRole: "tenant_admin" as const,
    xUserId: "x1"
  };
}

describe("/api/admin/tenants/[tenantId]/export-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole.mockResolvedValue(null);
    authMocks.requireGlobalAdminSession.mockResolvedValue(adminSession());
    cacheMocks.getTenantByHexIdCached.mockResolvedValue(baseTenant());
    exportRepoMocks.ensureTenantExportJobIndexes.mockResolvedValue(undefined);
    exportRepoMocks.listTenantExportJobsForTenant.mockResolvedValue([]);
  });

  it("GET returns 403 when not global_admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET_LIST(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(403);
  });

  it("GET lists jobs", async () => {
    const jid = new ObjectId();
    exportRepoMocks.listTenantExportJobsForTenant.mockResolvedValueOnce([
      {
        _id: jid,
        tenantId: new ObjectId(TENANT_HEX),
        kinds: ["live_spec_yaml"],
        status: "pending",
        createdAt: new Date("2026-05-02T10:00:00.000Z"),
        createdByUserId: new ObjectId("507f1f77bcf86cd799439011")
      }
    ]);
    const res = await GET_LIST(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { jobs: { jobId: string; status: string }[] };
    };
    expect(json.data.jobs).toHaveLength(1);
    expect(json.data.jobs[0]?.jobId).toBe(jid.toHexString());
    expect(json.data.jobs[0]?.status).toBe("pending");
  });

  it("POST returns 400 on invalid kinds", async () => {
    const res = await POST_ENQUEUE(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kinds: ["nope"] })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(400);
  });

  it("POST enqueues deduped kinds", async () => {
    const jid = new ObjectId();
    exportRepoMocks.insertTenantExportJob.mockResolvedValue({
      _id: jid,
      tenantId: new ObjectId(TENANT_HEX),
      kinds: ["live_spec_yaml", "bootstrap_audit_csv"],
      status: "pending",
      createdAt: new Date(),
      createdByUserId: new ObjectId("507f1f77bcf86cd799439011")
    });
    const res = await POST_ENQUEUE(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kinds: ["live_spec_yaml", "live_spec_yaml", "bootstrap_audit_csv"]
        })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(201);
    expect(exportRepoMocks.insertTenantExportJob).toHaveBeenCalledWith({
      tenantId: new ObjectId(TENANT_HEX),
      kinds: ["live_spec_yaml", "bootstrap_audit_csv"],
      createdByUserId: new ObjectId("507f1f77bcf86cd799439011")
    });
    const json = (await res.json()) as { data: { jobId: string } };
    expect(json.data.jobId).toBe(jid.toHexString());
  });
});

describe("/api/admin/tenants/[tenantId]/export-jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole.mockResolvedValue(null);
    authMocks.requireGlobalAdminSession.mockResolvedValue(adminSession());
    cacheMocks.getTenantByHexIdCached.mockResolvedValue(baseTenant());
    exportRepoMocks.getTenantExportJobById.mockResolvedValue(null);
  });

  it("GET returns 400 for invalid ObjectId", async () => {
    const res = await GET_JOB(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX, jobId: "bad" })
    });
    expect(res.status).toBe(400);
  });

  it("GET returns job detail", async () => {
    const jid = new ObjectId();
    exportRepoMocks.getTenantExportJobById.mockResolvedValue({
      _id: jid,
      tenantId: new ObjectId(TENANT_HEX),
      kinds: ["bootstrap_audit_csv"],
      status: "completed",
      createdAt: new Date("2026-05-02T10:00:00.000Z"),
      completedAt: new Date("2026-05-02T10:00:01.000Z"),
      createdByUserId: new ObjectId("507f1f77bcf86cd799439011"),
      artifacts: [{ kind: "bootstrap_audit_csv", filename: "audit.csv", byteLength: 12 }]
    });
    const res = await GET_JOB(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX, jobId: jid.toHexString() })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { artifacts?: { filename: string }[] } };
    expect(json.data.artifacts?.[0]?.filename).toBe("audit.csv");
    expect(exportRepoMocks.getTenantExportJobById).toHaveBeenCalledWith({
      jobId: jid,
      tenantId: new ObjectId(TENANT_HEX),
      omitArtifactBodies: true
    });
  });
});

describe("/api/admin/tenants/[tenantId]/export-jobs/[jobId]/artifact/[kind]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole.mockResolvedValue(null);
    authMocks.requireGlobalAdminSession.mockResolvedValue(adminSession());
    cacheMocks.getTenantByHexIdCached.mockResolvedValue(baseTenant());
    exportRepoMocks.getTenantExportJobById.mockResolvedValue(null);
  });

  it("GET returns 400 for unknown kind", async () => {
    const jid = new ObjectId();
    const res = await GET_ARTIFACT(new Request("http://test"), {
      params: Promise.resolve({
        tenantId: TENANT_HEX,
        jobId: jid.toHexString(),
        kind: "other"
      })
    });
    expect(res.status).toBe(400);
  });

  it("GET returns 409 when job not completed", async () => {
    const jid = new ObjectId();
    exportRepoMocks.getTenantExportJobById.mockResolvedValue({
      _id: jid,
      tenantId: new ObjectId(TENANT_HEX),
      kinds: ["live_spec_yaml"],
      status: "pending",
      createdAt: new Date(),
      createdByUserId: new ObjectId()
    });
    const res = await GET_ARTIFACT(new Request("http://test"), {
      params: Promise.resolve({
        tenantId: TENANT_HEX,
        jobId: jid.toHexString(),
        kind: "live_spec_yaml"
      })
    });
    expect(res.status).toBe(409);
  });

  it("GET streams YAML attachment when completed", async () => {
    const jid = new ObjectId();
    exportRepoMocks.getTenantExportJobById.mockResolvedValue({
      _id: jid,
      tenantId: new ObjectId(TENANT_HEX),
      kinds: ["live_spec_yaml"],
      status: "completed",
      createdAt: new Date(),
      completedAt: new Date(),
      createdByUserId: new ObjectId(),
      artifacts: [
        {
          kind: "live_spec_yaml",
          filename: "tenant-live.yaml",
          byteLength: 7,
          content: "foo: 1\n"
        }
      ]
    });
    const res = await GET_ARTIFACT(new Request("http://test"), {
      params: Promise.resolve({
        tenantId: TENANT_HEX,
        jobId: jid.toHexString(),
        kind: "live_spec_yaml"
      })
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("yaml");
    expect(res.headers.get("Content-Disposition")).toContain("tenant-live.yaml");
    const text = await res.text();
    expect(text).toBe("foo: 1\n");
  });
});
