import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiAuthMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  PersonaNameConflictError: class PersonaNameConflictError extends Error {
    readonly code = "PERSONA_NAME_CONFLICT";

    constructor() {
      super("A persona with that name already exists");
      this.name = "PersonaNameConflictError";
    }
  },
  listPersonas: vi.fn(),
  createPersona: vi.fn(),
  getPersonaById: vi.fn(),
  updatePersona: vi.fn(),
  deletePersona: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn(),
  listAuditEventsForEntity: vi.fn(),
  listLatestAuditEventsForEntities: vi.fn()
}));

const verifierMocks = vi.hoisted(() => ({
  triggerXaiCollectionVerification: vi.fn()
}));

vi.mock("@/lib/api-auth", () => apiAuthMocks);
vi.mock("@/modules/xchat/repository", () => repositoryMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/xchat/xai-collection-verifier", () => verifierMocks);

import { GET as getPersonas, POST as postPersona } from "@/app/api/personas/route";
import {
  DELETE as deletePersonaById,
  GET as getPersonaByIdRoute,
  PUT as putPersonaById
} from "@/app/api/personas/[personaId]/route";
import { POST as postVerifyPersonaCollection } from "@/app/api/personas/[personaId]/verify-collection/route";

describe("persona API routes", () => {
  const now = new Date("2026-03-16T00:00:00.000Z");

  beforeEach(() => {
    apiAuthMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"]
    });
    repositoryMocks.listPersonas.mockResolvedValue([
      {
        _id: new ObjectId("507f1f77bcf86cd799439033"),
        name: "Analyst",
        nameNormalized: "analyst",
        systemPrompt: "You are an analyst persona for xFinance admins.",
        overridePrompt: "Rewrite user input as a technical brief.",
        xaiCollection: {
          collectionId: "collection_analyst-global",
          collectionName: "Analyst Global Docs"
        },
        xaiCollectionVerification: {
          status: "verified",
          checkedAt: now,
          resolvedCollectionName: "Analyst Global Docs"
        },
        model: "grok-4-latest",
        temperature: 0.2,
        enableRag: true,
        defaultScope: "global",
        createdAt: now,
        updatedAt: now
      }
    ]);
    repositoryMocks.createPersona.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439044"),
      name: "Trader",
      nameNormalized: "trader",
      systemPrompt: "You are a trader persona for execution planning.",
      overridePrompt: "Convert asks into actionable trading playbooks.",
      xaiCollection: {
        collectionId: "collection_trader-global",
        collectionName: "Trader Global Docs"
      },
      model: "grok-4-latest",
      temperature: 0.2,
      enableRag: true,
      defaultScope: "global",
      createdAt: now,
      updatedAt: now
    });
    repositoryMocks.getPersonaById.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439055"),
      name: "Ops",
      nameNormalized: "ops",
      systemPrompt: "You are an operations persona for controls and audit.",
      overridePrompt: "Summarize as an action plan.",
      xaiCollection: {
        collectionId: "collection_ops-global",
        collectionName: "Ops Global Docs"
      },
      model: "grok-4-latest",
      temperature: 0.1,
      enableRag: false,
      defaultScope: "global",
      createdAt: now,
      updatedAt: now
    });
    repositoryMocks.updatePersona.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439055"),
      name: "Ops Updated",
      nameNormalized: "ops updated",
      systemPrompt: "You are an updated operations persona.",
      overridePrompt: "Answer with checklist format.",
      xaiCollection: {
        collectionId: "collection_ops-global-v2",
        collectionName: "Ops Global Docs v2"
      },
      model: "grok-4-latest",
      temperature: 0.3,
      enableRag: true,
      defaultScope: "global",
      createdAt: now,
      updatedAt: now
    });
    repositoryMocks.deletePersona.mockResolvedValue(true);
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    auditMocks.listAuditEventsForEntity.mockResolvedValue([]);
    auditMocks.listLatestAuditEventsForEntities.mockResolvedValue({});
    verifierMocks.triggerXaiCollectionVerification.mockReturnValue({
      started: true
    });
  });

  it("allows admins to read persona list", async () => {
    const response = await getPersonas();
    const payload = (await response.json()) as {
      data: Array<{
        _id: string;
        overridePrompt: string;
        xaiCollection: { collectionId: string };
        xaiCollectionVerification: { status: string; checkedAt: string } | null;
      }>;
    };

    expect(response.status).toBe(200);
    expect(apiAuthMocks.requireAdminSession).toHaveBeenCalledTimes(1);
    expect(payload.data[0]?._id).toBe("507f1f77bcf86cd799439033");
    expect(payload.data[0]?.overridePrompt).toBe("Rewrite user input as a technical brief.");
    expect(payload.data[0]?.xaiCollection.collectionId).toBe("collection_analyst-global");
    expect(payload.data[0]?.xaiCollectionVerification?.status).toBe("verified");
    expect(payload.data[0]?.xaiCollectionVerification?.checkedAt).toBe(now.toISOString());
  });

  it("creates persona with admin permissions", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Trader",
          systemPrompt: "You are a trader persona for execution planning.",
          overridePrompt: "Convert asks into execution plans.",
          xaiCollection: {
            collectionId: "collection_trader-global",
            collectionName: "Trader Global Docs"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.createPersona).toHaveBeenCalledTimes(1);
  });

  it("creates persona without override prompt", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "NoOverride",
          systemPrompt: "You are a persona that works without an override prompt.",
          xaiCollection: {
            collectionId: "collection_no-override-global",
            collectionName: "No Override Global Docs"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.createPersona).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "NoOverride",
        overridePrompt: ""
      })
    );
  });

  it("does not fail create when audit write fails", async () => {
    auditMocks.createAuditEvent.mockRejectedValueOnce(new Error("audit unavailable"));

    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Trader",
          systemPrompt: "You are a trader persona for execution planning.",
          overridePrompt: "Convert asks into execution plans.",
          xaiCollection: {
            collectionId: "collection_trader-global",
            collectionName: "Trader Global Docs"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(201);
  });

  it("creates persona when temperature is localized string", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Localized",
          systemPrompt: "You are a localized persona for regional users.",
          overridePrompt: "Convert asks into localized technical actions.",
          xaiCollection: {
            collectionId: "collection_localized-global",
            collectionName: "Localized Global Docs"
          },
          model: "grok-4-latest",
          temperature: "0,2",
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.createPersona).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.2 })
    );
  });

  it("creates persona when enableRag is boolean-like string", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "BooleanString",
          systemPrompt: "You are a persona that accepts string booleans on input.",
          overridePrompt: "Treat boolean-like values as control flags.",
          xaiCollection: {
            collectionId: "collection_boolean-global",
            collectionName: "Boolean Global Docs"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: "true",
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.createPersona).toHaveBeenCalledWith(
      expect.objectContaining({ enableRag: true })
    );
  });

  it("rejects create when prompt exceeds max length", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "TooLong",
          systemPrompt: "a".repeat(16_001),
          overridePrompt: "Still required.",
          xaiCollection: {
            collectionId: "collection_too-long",
            collectionName: "Too Long Docs"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(400);
    expect(repositoryMocks.createPersona).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "TooLong" })
    );
  });

  it("rejects create when payload is too large", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "40000"
        },
        body: JSON.stringify({
          name: "LargePayload",
          systemPrompt: "You are a trader persona for execution planning.",
          overridePrompt: "Convert asks into execution plans.",
          xaiCollection: {
            collectionId: "collection_large-payload",
            collectionName: "Large Payload Docs"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(413);
  });

  it("reads persona by id for admin", async () => {
    const response = await getPersonaByIdRoute(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    const payload = (await response.json()) as { data: { name: string } };

    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Ops");
  });

  it("updates persona by id for admin", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ops Updated",
          systemPrompt: "You are an updated operations persona.",
          overridePrompt: "Answer with checklist format.",
          xaiCollection: {
            collectionId: "collection_ops-global-v2",
            collectionName: "Ops Global Docs v2"
          },
          temperature: 0.3,
          enableRag: true
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.objectContaining({ name: "Ops Updated" })
    );
  });

  it("updates persona when override prompt is empty", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ops Updated",
          overridePrompt: ""
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.objectContaining({
        name: "Ops Updated",
        overridePrompt: ""
      })
    );
  });

  it("does not fail update when audit write fails", async () => {
    auditMocks.createAuditEvent.mockRejectedValueOnce(new Error("audit unavailable"));

    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ops Updated",
          systemPrompt: "You are an updated operations persona.",
          overridePrompt: "Answer with checklist format.",
          xaiCollection: {
            collectionId: "collection_ops-global-v2",
            collectionName: "Ops Global Docs v2"
          },
          temperature: 0.3,
          enableRag: true
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(200);
  });

  it("updates persona when temperature is localized string", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temperature: "0,7"
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.objectContaining({ temperature: 0.7 })
    );
  });

  it("updates persona when boolean-like string is provided", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enableRag: "false"
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.objectContaining({ enableRag: false })
    );
  });

  it("updates persona xai collection fields", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xaiCollection: {
            collectionId: "collection_ops-global-v3",
            collectionName: "Ops Global Docs v3"
          }
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.objectContaining({
        xaiCollection: {
          collectionId: "collection_ops-global-v3",
          collectionName: "Ops Global Docs v3"
        }
      })
    );
  });

  it("ignores empty optional string fields on update", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: " ",
          defaultScope: "   ",
          temperature: "0,7"
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.not.objectContaining({
        model: expect.anything(),
        defaultScope: expect.anything()
      })
    );
    expect(repositoryMocks.updatePersona).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439055",
      expect.objectContaining({ temperature: 0.7 })
    );
  });

  it("rejects update when prompt exceeds max length", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: "b".repeat(16_001)
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(400);
  });

  it("rejects update when payload is too large", async () => {
    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "40000"
        },
        body: JSON.stringify({
          name: "StillSmallButHeaderSaysLarge"
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );

    expect(response.status).toBe(413);
  });

  it("deletes persona by id for admin", async () => {
    const response = await deletePersonaById(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });

    expect(response.status).toBe(200);
    expect(repositoryMocks.deletePersona).toHaveBeenCalledWith("507f1f77bcf86cd799439055");
  });

  it("triggers persona collection recheck for admin", async () => {
    const response = await postVerifyPersonaCollection(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    const payload = (await response.json()) as {
      data: { personaId: string; collectionId: string; started: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.data.started).toBe(true);
    expect(payload.data.personaId).toBe("507f1f77bcf86cd799439055");
    expect(payload.data.collectionId).toBe("collection_ops-global");
    expect(verifierMocks.triggerXaiCollectionVerification).toHaveBeenCalledWith(
      "collection_ops-global"
    );
  });

  it("returns not found when recheck persona does not exist", async () => {
    repositoryMocks.getPersonaById.mockResolvedValueOnce(null);

    const response = await postVerifyPersonaCollection(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439099" })
    });

    expect(response.status).toBe(404);
  });

  it("does not fail delete when audit write fails", async () => {
    auditMocks.createAuditEvent.mockRejectedValueOnce(new Error("audit unavailable"));

    const response = await deletePersonaById(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });

    expect(response.status).toBe(200);
  });

  it("returns auth response when unauthenticated on read route", async () => {
    apiAuthMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await getPersonas();
    expect(response.status).toBe(401);
  });

  it("returns auth response when unauthenticated on verify route", async () => {
    apiAuthMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await postVerifyPersonaCollection(new Request("http://test"), {
      params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
    });
    expect(response.status).toBe(401);
  });

  it("rejects create when xai collection id is invalid", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "InvalidCollection",
          systemPrompt: "You are an ops persona with invalid collection id input.",
          overridePrompt: "Convert asks into controlled responses.",
          xaiCollection: {
            collectionId: "invalid_collection_id"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(400);
  });

  it("allows create when xai collection is missing", async () => {
    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "MissingCollection",
          systemPrompt: "You are an ops persona missing collection binding.",
          overridePrompt: "Convert asks into controlled responses.",
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.createPersona).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "MissingCollection",
        xaiCollection: expect.objectContaining({
          collectionId: ""
        })
      })
    );
  });

  it("returns conflict on duplicate persona name create", async () => {
    repositoryMocks.createPersona.mockRejectedValueOnce(
      new repositoryMocks.PersonaNameConflictError()
    );

    const response = await postPersona(
      new Request("http://test/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Trader",
          systemPrompt: "You are a trader persona for execution planning.",
          overridePrompt: "Convert asks into execution plans.",
          xaiCollection: {
            collectionId: "collection_trader-global",
            collectionName: "Trader Global Docs"
          },
          model: "grok-4-latest",
          temperature: 0.2,
          enableRag: true,
          defaultScope: "global"
        })
      })
    );
    const payload = (await response.json()) as { code?: string };

    expect(response.status).toBe(409);
    expect(payload.code).toBe("PERSONA_NAME_CONFLICT");
  });

  it("returns conflict on duplicate persona name update", async () => {
    repositoryMocks.updatePersona.mockRejectedValueOnce(
      new repositoryMocks.PersonaNameConflictError()
    );

    const response = await putPersonaById(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Trader",
          systemPrompt: "You are a trader persona for execution planning.",
          overridePrompt: "Convert asks into execution plans.",
          xaiCollection: {
            collectionId: "collection_trader-global",
            collectionName: "Trader Global Docs"
          }
        })
      }),
      {
        params: Promise.resolve({ personaId: "507f1f77bcf86cd799439055" })
      }
    );
    const payload = (await response.json()) as { code?: string };

    expect(response.status).toBe(409);
    expect(payload.code).toBe("PERSONA_NAME_CONFLICT");
  });
});
