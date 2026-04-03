import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>(),
  proxyPersonasRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));
const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn(),
  requireAdminSession: vi.fn()
}));
const repositoryMocks = vi.hoisted(() => ({
  listPersonas: vi.fn(),
  listPersonasByStatus: vi.fn(),
  createPersona: vi.fn()
}));
const auditMocks = vi.hoisted(() => ({
  listLatestAuditEventsForEntities: vi.fn(),
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend,
  proxyPersonasRequestToBackend: bffMocks.proxyPersonasRequestToBackend
}));
vi.mock("@/lib/auth", () => ({
  requireSessionUser: authMocks.requireSessionUser
}));
vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: authMocks.requireAdminSession
}));
vi.mock("@/modules/xchat/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/repository")>();
  return {
    ...actual,
    listPersonas: repositoryMocks.listPersonas,
    listPersonasByStatus: repositoryMocks.listPersonasByStatus,
    createPersona: repositoryMocks.createPersona
  };
});
vi.mock("@/modules/audit/repository", () => ({
  listLatestAuditEventsForEntities: auditMocks.listLatestAuditEventsForEntities,
  createAuditEvent: auditMocks.createAuditEvent
}));

import { POST as postAccessRequest } from "@/app/api/access-requests/route";
import { GET as getPersonas, POST as postPersona } from "@/app/api/personas/route";

describe("personas + access-requests BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    bffMocks.proxyPersonasRequestToBackend.mockResolvedValue(null);
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "admin@atxfinance.ai",
      username: "admin",
      roles: ["global_admin"]
    });
    repositoryMocks.listPersonas.mockResolvedValue([]);
    repositoryMocks.listPersonasByStatus.mockResolvedValue([]);
    repositoryMocks.createPersona.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      name: "Persona P",
      systemPrompt: "1234567890",
      overridePrompt: "",
      xaiCollection: { collectionId: "", collectionName: "" },
      model: "grok-4-1-fast-reasoning",
      temperature: 0.2,
      enableRag: true,
      defaultScope: "global",
      xapi: { mode: "responses", toolChoice: "auto", maxTurns: 5, tools: [] },
      status: "draft",
      version: 1,
      publishedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });
    auditMocks.listLatestAuditEventsForEntities.mockResolvedValue({});
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
  });

  it("POST /api/access-requests returns backend response when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ ok: true, data: { status: "pending" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Please grant access for testing the BFF path." })
    });
    const response = await postAccessRequest(req);

    expect(response.status).toBe(201);
    expect(bffMocks.proxyRequestToBackend).toHaveBeenCalledWith(req);
  });

  it("GET /api/personas returns backend response when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: [{ name: "remote" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPersonasRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/personas");
    const response = await getPersonas(req);

    expect(response.status).toBe(200);
    expect(bffMocks.proxyPersonasRequestToBackend).toHaveBeenCalledWith(req);
    expect(repositoryMocks.listPersonas).not.toHaveBeenCalled();
  });

  it("GET /api/personas falls back to local handler when proxy returns null", async () => {
    const req = new Request("http://test/api/personas");
    const response = await getPersonas(req);

    expect(response.status).toBe(200);
    expect(bffMocks.proxyPersonasRequestToBackend).toHaveBeenCalledWith(req);
    expect(repositoryMocks.listPersonas).toHaveBeenCalled();
  });

  it("POST /api/personas returns backend response when proxy resolves non-null", async () => {
    const proxied = new Response(JSON.stringify({ data: { name: "created-remote" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
    bffMocks.proxyPersonasRequestToBackend.mockResolvedValueOnce(proxied);

    const req = new Request("http://test/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Persona P",
        systemPrompt: "1234567890",
        model: "grok-4-1-fast-reasoning",
        temperature: 0.2,
        enableRag: true,
        defaultScope: "global",
        xapi: { mode: "responses", toolChoice: "auto", maxTurns: 5, tools: [] }
      })
    });
    const response = await postPersona(req);

    expect(response.status).toBe(201);
    expect(bffMocks.proxyPersonasRequestToBackend).toHaveBeenCalledWith(req);
    expect(repositoryMocks.createPersona).not.toHaveBeenCalled();
  });

  it("POST /api/personas falls back to local handler when proxy returns null", async () => {
    const req = new Request("http://test/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Persona P",
        systemPrompt: "1234567890",
        model: "grok-4-1-fast-reasoning",
        temperature: 0.2,
        enableRag: true,
        defaultScope: "global",
        xapi: { mode: "responses", toolChoice: "auto", maxTurns: 5, tools: [] }
      })
    });
    const response = await postPersona(req);

    expect(response.status).toBe(201);
    expect(bffMocks.proxyPersonasRequestToBackend).toHaveBeenCalledWith(req);
    expect(repositoryMocks.createPersona).toHaveBeenCalled();
  });
});
