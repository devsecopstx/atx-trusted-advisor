import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { listPersonaVersions } from "@/modules/xchat/repository";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) return session;

  const { personaId } = await context.params;
  const versions = await listPersonaVersions(personaId);

  return NextResponse.json({
    data: versions.map((v) => ({
      _id: v._id?.toHexString(),
      personaId: v.personaId.toHexString(),
      version: v.version,
      action: v.action,
      actor: v.actor,
      snapshotName: v.snapshot.name,
      snapshotModel: v.snapshot.model,
      createdAt: v.createdAt.toISOString()
    }))
  });
}
