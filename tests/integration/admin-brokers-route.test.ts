import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminListBrokerCatalog: vi.fn(),
  adminCreateBrokerCatalogEntry: vi.fn(),
  adminUpdateBrokerCatalogEntry: vi.fn(),
  adminDeleteBrokerCatalogEntry: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => repoMocks);

import { DELETE as deleteBroker, PATCH as patchBroker } from "@/app/api/admin/brokers/[brokerId]/route";
import { GET as getBrokers, POST as postBrokers } from "@/app/api/admin/brokers/route";

const brokerId = "507f1f77bcf86cd799439044";

function mockBroker(overrides: Partial<{ type: string; name: string }> = {}) {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: new ObjectId(brokerId),
    type: overrides.type ?? "merrill",
    name: overrides.name ?? "Merrill Edge",
    description: "Test",
    createdAt: now,
    updatedAt: now
  };
}

describe("/api/admin/brokers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    repoMocks.adminListBrokerCatalog.mockResolvedValue([mockBroker()]);
    repoMocks.adminCreateBrokerCatalogEntry.mockResolvedValue(mockBroker({ type: "schwab", name: "Schwab" }));
    repoMocks.adminUpdateBrokerCatalogEntry.mockResolvedValue(mockBroker({ name: "Updated" }));
    repoMocks.adminDeleteBrokerCatalogEntry.mockResolvedValue(true);
  });

  it("GET returns catalog rows", async () => {
    const res = await getBrokers();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { type: string; name: string }[] };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.type).toBe("merrill");
  });

  it("POST creates a broker", async () => {
    const req = new Request("http://test/api/admin/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "schwab", name: "Charles Schwab", description: "Retail" })
    });
    const res = await postBrokers(req);
    expect(res.status).toBe(201);
    expect(repoMocks.adminCreateBrokerCatalogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ type: "schwab", name: "Charles Schwab" })
    );
  });

  it("PATCH updates a broker", async () => {
    const req = new Request(`http://test/api/admin/brokers/${brokerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" })
    });
    const res = await patchBroker(req, { params: Promise.resolve({ brokerId }) });
    expect(res.status).toBe(200);
    expect(repoMocks.adminUpdateBrokerCatalogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: brokerId,
        patch: expect.objectContaining({ name: "Updated" })
      })
    );
  });

  it("DELETE removes a broker", async () => {
    const res = await deleteBroker(new Request(`http://test/api/admin/brokers/${brokerId}`), {
      params: Promise.resolve({ brokerId })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.adminDeleteBrokerCatalogEntry).toHaveBeenCalledWith(brokerId);
  });

  it("rejects unauthenticated admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(NextResponse.json({ error: "nope" }, { status: 401 }));
    const res = await getBrokers();
    expect(res.status).toBe(401);
  });
});
