import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getPersonaByIdCached } from "@/lib/server-request-cache";
import { createXaiCollection } from "@/lib/xai";
import { updatePersona } from "@/modules/xchat/repository";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { personaId } = await context.params;
  const persona = await getPersonaByIdCached(personaId);
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  const collection = await createXaiCollection(`${persona.name} Knowledge Base`);
  const updated = await updatePersona(personaId, {
    xaiCollection: {
      collectionId: collection.id,
      collectionName: collection.name
    }
  });
  if (!updated) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      personaId,
      collectionId: collection.id,
      collectionName: collection.name
    }
  });
}
