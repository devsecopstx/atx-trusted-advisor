import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { archivePersona, getPersonaById } from "@/modules/xchat/repository";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const { personaId } = await context.params;
  const existing = await getPersonaById(personaId);
  if (!existing) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  if (existing.status === "archived") {
    return NextResponse.json({ error: "Persona is already archived" }, { status: 409 });
  }

  const actor = { userId: session.userId, email: session.email, username: session.username };
  const updated = await archivePersona(personaId, actor);
  if (!updated) {
    return NextResponse.json({ error: "Failed to archive persona" }, { status: 500 });
  }

  await createAuditEvent({
    entityType: "xpersona",
    entityId: personaId,
    action: "archived",
    actor,
    details: { version: updated.version, name: updated.name }
  }).catch((error) => {
    console.error("persona archive audit write failed", { personaId, error: String(error) });
  });

  return NextResponse.json({
    data: {
      _id: updated._id?.toHexString(),
      name: updated.name,
      status: updated.status,
      version: updated.version
    }
  });
}
