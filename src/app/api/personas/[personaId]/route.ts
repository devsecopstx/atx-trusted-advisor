import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { getPersonaByIdCached } from "@/lib/server-request-cache";
import { createAuditEvent, listAuditEventsForEntity } from "@/modules/audit/repository";
import {
    hasFileSearchTool,
    isPersonaPayloadTooLargeByBody,
    isPersonaPayloadTooLargeByHeader,
    personaSatisfiesFileSearchCollectionRequirement,
    updatePersonaPayloadSchema
} from "@/modules/xchat/persona-validation";
import { PersonaNameConflictError, deletePersona, updatePersona } from "@/modules/xchat/repository";
import { normalizePersonaXapiConfig, type PersonaConfig } from "@/modules/xchat/types";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { personaId } = await context.params;
  const persona = await getPersonaByIdCached(personaId);
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  const auditTrail = await listAuditEventsForEntity({
    entityType: "xpersona",
    entityId: personaId
  });
  return NextResponse.json({
    data: {
      ...serializePersona(persona),
      auditTrail: auditTrail.map(serializeAuditEvent)
    }
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  if (isPersonaPayloadTooLargeByHeader(request)) {
    return NextResponse.json({ error: "Persona payload too large" }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  if (isPersonaPayloadTooLargeByBody(body)) {
    return NextResponse.json({ error: "Persona payload too large" }, { status: 413 });
  }
  const parsed = updatePersonaPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid persona payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { personaId } = await context.params;
  const existingPersona = await getPersonaByIdCached(personaId);
  if (!existingPersona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  const mergedForFileSearch = {
    xaiCollection:
      parsed.data.xaiCollection !== undefined
        ? parsed.data.xaiCollection
        : existingPersona.xaiCollection,
    teamCollection:
      parsed.data.teamCollection !== undefined
        ? parsed.data.teamCollection
        : existingPersona.teamCollection,
    xapi: normalizePersonaXapiConfig(parsed.data.xapi ?? existingPersona.xapi)
  };
  if (
    hasFileSearchTool(mergedForFileSearch.xapi.tools) &&
    !personaSatisfiesFileSearchCollectionRequirement(mergedForFileSearch)
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid persona payload: collection search requires xaiCollection, teamCollection, or collection ids on tools"
      },
      { status: 400 }
    );
  }

  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  ) as Partial<Omit<PersonaConfig, "_id" | "createdAt" | "updatedAt">>;
  let updated: PersonaConfig | null;
  try {
    updated = await updatePersona(personaId, updates);
  } catch (error) {
    if (error instanceof PersonaNameConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 }
      );
    }
    throw error;
  }
  if (!updated) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  enqueueAuditEvent({
    entityType: "xpersona",
    entityId: personaId,
    action: "updated",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      changedFields: Object.keys(updates)
    }
  });
  return NextResponse.json({ data: serializePersona(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { personaId } = await context.params;
  const existing = await getPersonaByIdCached(personaId);
  if (!existing) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  const deleted = await deletePersona(personaId);
  if (!deleted) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  enqueueAuditEvent({
    entityType: "xpersona",
    entityId: personaId,
    action: "deleted",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      name: existing.name
    }
  });
  return NextResponse.json({ ok: true });
}

function enqueueAuditEvent(input: Parameters<typeof createAuditEvent>[0]) {
  void createAuditEvent(input).catch((error: unknown) => {
    console.error("xpersona audit write failed", {
      action: input.action,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : "Unknown audit error"
    });
  });
}

function serializePersona(persona: PersonaConfig) {
  return {
    _id: persona._id?.toHexString(),
    name: persona.name,
    systemPrompt: persona.systemPrompt,
    overridePrompt: persona.overridePrompt ?? "",
    xaiCollection: {
      collectionId: persona.xaiCollection?.collectionId ?? "",
      collectionName: persona.xaiCollection?.collectionName
    },
    teamCollection: {
      collectionId: persona.teamCollection?.collectionId ?? "",
      collectionName: persona.teamCollection?.collectionName
    },
    model: persona.model,
    temperature: persona.temperature,
    enableRag: persona.enableRag,
    defaultScope: persona.defaultScope,
    xapi: normalizePersonaXapiConfig(persona.xapi),
    status: persona.status ?? "draft",
    version: persona.version ?? 0,
    publishedAt: persona.publishedAt?.toISOString() ?? null,
    isSystem: persona.isSystem ?? false,
    lastXaiPersonaSync: persona.lastXaiPersonaSync
      ? {
          at: persona.lastXaiPersonaSync.at.toISOString(),
          byUserId: persona.lastXaiPersonaSync.byUserId,
          collectionDisplayName: persona.lastXaiPersonaSync.collectionDisplayName
        }
      : null,
    xaiCollectionVerification: persona.xaiCollectionVerification
      ? {
          ...persona.xaiCollectionVerification,
          checkedAt: persona.xaiCollectionVerification.checkedAt.toISOString()
        }
      : null,
    createdAt: persona.createdAt.toISOString(),
    updatedAt: persona.updatedAt.toISOString()
  };
}

function serializeAuditEvent(event: {
  action: string;
  createdAt: Date;
  actor: { userId: string; email?: string; username?: string };
  details?: Record<string, unknown>;
}) {
  return {
    action: event.action,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor,
    details: event.details
  };
}
