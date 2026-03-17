import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getPersonaById } from "@/modules/xchat/repository";
import { triggerXaiCollectionVerification } from "@/modules/xchat/xai-collection-verifier";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { personaId } = await context.params;
  const persona = await getPersonaById(personaId);
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  const collectionId = persona.xaiCollection?.collectionId?.trim();
  if (!collectionId) {
    return NextResponse.json({ error: "Persona collection id missing" }, { status: 400 });
  }

  const result = triggerXaiCollectionVerification(collectionId);
  return NextResponse.json({
    data: {
      personaId,
      collectionId,
      ...result
    }
  });
}
