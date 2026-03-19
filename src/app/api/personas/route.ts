import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { requireSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import {
  createAuditEvent,
  listLatestAuditEventsForEntities
} from "@/modules/audit/repository";
import {
  createPersonaPayloadSchema,
  isPersonaPayloadTooLargeByBody,
  isPersonaPayloadTooLargeByHeader
} from "@/modules/xchat/persona-validation";
import {
  PersonaNameConflictError,
  createPersona,
  listPersonas,
  listPersonasByStatus
} from "@/modules/xchat/repository";
import { normalizePersonaXapiConfig, type PersonaConfig, type PersonaStatus, personaStatusValues } from "@/modules/xchat/types";

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const isAdmin = isGlobalAdmin(session.roles);

  let personas: PersonaConfig[];
  if (!isAdmin) {
    personas = await listPersonasByStatus("published");
  } else if (statusParam && (personaStatusValues as readonly string[]).includes(statusParam)) {
    personas = await listPersonasByStatus(statusParam as PersonaStatus);
  } else {
    personas = await listPersonas();
  }

  const serialized = personas.map(serializePersona);
  const latestAuditByPersonaId = isAdmin
    ? await listLatestAuditEventsForEntities({
        entityType: "xpersona",
        entityIds: serialized.flatMap((persona) => (persona._id ? [persona._id] : []))
      })
    : {};
  return NextResponse.json({
    data: serialized.map((persona) => ({
      ...persona,
      latestAuditEvent: persona._id ? serializeAuditEvent(latestAuditByPersonaId[persona._id]) : null
    }))
  });
}

export async function POST(request: Request) {
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
  const parsed = createPersonaPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid persona payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let persona: PersonaConfig;
  try {
    persona = await createPersona({
      ...parsed.data,
      overridePrompt: parsed.data.overridePrompt ?? "",
      xaiCollection: {
        collectionId: parsed.data.xaiCollection?.collectionId ?? "",
        collectionName: parsed.data.xaiCollection?.collectionName
      },
      xapi: normalizePersonaXapiConfig(parsed.data.xapi)
    });
  } catch (error) {
    if (error instanceof PersonaNameConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 }
      );
    }
    throw error;
  }
  const serialized = serializePersona(persona);
  if (serialized._id) {
    enqueueAuditEvent({
      entityType: "xpersona",
      entityId: serialized._id,
      action: "created",
      actor: {
        userId: session.userId,
        email: session.email,
        username: session.username
      },
      details: {
        name: serialized.name,
        model: serialized.model,
        defaultScope: serialized.defaultScope
      }
    });
  }
  return NextResponse.json({ data: serialized }, { status: 201 });
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
    model: persona.model,
    temperature: persona.temperature,
    enableRag: persona.enableRag,
    defaultScope: persona.defaultScope,
    xapi: normalizePersonaXapiConfig(persona.xapi),
    status: persona.status ?? "draft",
    version: persona.version ?? 0,
    publishedAt: persona.publishedAt?.toISOString() ?? null,
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

function serializeAuditEvent(
  event:
    | {
        action: string;
        createdAt: Date;
        actor: { userId: string; email?: string; username?: string };
        details?: Record<string, unknown>;
      }
    | undefined
) {
  if (!event) {
    return null;
  }
  return {
    action: event.action,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor,
    details: event.details
  };
}
