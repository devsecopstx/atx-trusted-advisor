import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { getPersonaByIdCached } from "@/lib/server-request-cache";
import { createAuditEvent } from "@/modules/audit/repository";
import { rollbackPersona } from "@/modules/xchat/repository";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

const rollbackSchema = z.object({
  targetVersion: z.number().int().min(1)
});

export async function POST(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const { personaId } = await context.params;
  const existing = await getPersonaByIdCached(personaId);
  if (!existing) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = rollbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const actor = { userId: session.userId, email: session.email, username: session.username };
  const updated = await rollbackPersona(personaId, parsed.data.targetVersion, actor);
  if (!updated) {
    return NextResponse.json(
      { error: `Version ${parsed.data.targetVersion} not found for this persona` },
      { status: 404 }
    );
  }

  await createAuditEvent({
    entityType: "xpersona",
    entityId: personaId,
    action: "rolled_back",
    actor,
    details: {
      targetVersion: parsed.data.targetVersion,
      newVersion: updated.version,
      name: updated.name
    }
  }).catch((error) => {
    console.error("persona rollback audit write failed", { personaId, error: String(error) });
  });

  return NextResponse.json({
    data: {
      _id: updated._id?.toHexString(),
      name: updated.name,
      status: updated.status,
      version: updated.version,
      publishedAt: updated.publishedAt?.toISOString()
    }
  });
}
