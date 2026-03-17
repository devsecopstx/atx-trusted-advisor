import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { getPersonaById, publishPersona } from "@/modules/xchat/repository";

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

  if (existing.status === "published") {
    return NextResponse.json({ error: "Persona is already published" }, { status: 409 });
  }

  const actor = { userId: session.userId, email: session.email, username: session.username };
  const updated = await publishPersona(personaId, actor);
  if (!updated) {
    return NextResponse.json({ error: "Failed to publish persona" }, { status: 500 });
  }

  await createAuditEvent({
    entityType: "xpersona",
    entityId: personaId,
    action: "published",
    actor,
    details: { version: updated.version, name: updated.name }
  }).catch((error) => {
    console.error("persona publish audit write failed", { personaId, error: String(error) });
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
