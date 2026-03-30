import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getPersonaByIdCached } from "@/lib/server-request-cache";
import {
    getXchatPlatformSettings,
    upsertXchatPlatformSettings
} from "@/modules/xchat/xchat-platform-settings";

const patchSchema = z.object({
  defaultAppUserPersonaId: z.union([z.string().trim().min(1), z.null()]).optional()
});

export async function GET() {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const doc = await getXchatPlatformSettings();
  return NextResponse.json({
    data: {
      defaultAppUserPersonaId: doc?.defaultAppUserPersonaId ?? null,
      updatedAt: doc?.updatedAt?.toISOString() ?? null,
      updatedByUserId: doc?.updatedByUserId ?? null
    }
  });
}

export async function PATCH(request: Request) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const rawId = parsed.data.defaultAppUserPersonaId;
  if (rawId === undefined) {
    return NextResponse.json({ error: "defaultAppUserPersonaId is required (or null to clear)" }, { status: 400 });
  }

  if (rawId === null) {
    const next = await upsertXchatPlatformSettings({
      defaultAppUserPersonaId: null,
      actorUserId: session.userId
    });
    return NextResponse.json({
      data: {
        defaultAppUserPersonaId: next.defaultAppUserPersonaId ?? null,
        updatedAt: next.updatedAt.toISOString()
      }
    });
  }

  if (!ObjectId.isValid(rawId)) {
    return NextResponse.json(
      { error: "defaultAppUserPersonaId must be a valid persona ObjectId", code: "invalid_persona_id" },
      { status: 400 }
    );
  }

  const persona = await getPersonaByIdCached(rawId);
  if (!persona) {
    return NextResponse.json({ error: "Persona not found", code: "persona_not_found" }, { status: 404 });
  }
  if (persona.status !== "published") {
    return NextResponse.json(
      {
        error: "Only published personas can be the platform default for app users",
        code: "persona_not_published"
      },
      { status: 400 }
    );
  }

  const next = await upsertXchatPlatformSettings({
    defaultAppUserPersonaId: rawId,
    actorUserId: session.userId
  });

  return NextResponse.json({
    data: {
      defaultAppUserPersonaId: next.defaultAppUserPersonaId ?? null,
      personaName: persona.name,
      updatedAt: next.updatedAt.toISOString()
    }
  });
}
