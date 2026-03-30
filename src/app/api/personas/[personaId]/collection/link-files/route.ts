import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/api-auth";
import { getPersonaByIdCached } from "@/lib/server-request-cache";
import { addFileToXaiCollection } from "@/lib/xai";
import { evaluateRagFileReadiness, isRagFileReadyForSemanticSearch } from "@/modules/xchat/rag-file-readiness";
import { listRagFiles } from "@/modules/xchat/repository";

type RouteContext = {
  params: Promise<{ personaId: string }>;
};

const linkFilesPayloadSchema = z.object({
  fileIds: z.array(z.string().trim().min(1)).max(200).optional()
});

export async function POST(request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { personaId } = await context.params;
  const persona = await getPersonaByIdCached(personaId);
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  const collectionId = persona.xaiCollection?.collectionId?.trim();
  if (!collectionId) {
    return NextResponse.json({ error: "Persona collection id missing" }, { status: 400 });
  }

  const parsedBody = linkFilesPayloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid link files payload", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }
  const selectedFileIds = new Set(parsedBody.data.fileIds ?? []);

  const tenantId = ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : undefined;
  const files = await listRagFiles({
    scope: persona.defaultScope,
    tenantId
  });
  const candidateFiles = files.filter((file) => {
    if (selectedFileIds.size === 0) {
      return true;
    }
    const id = file._id?.toHexString();
    return Boolean(id && selectedFileIds.has(id));
  });
  const uploadedFiles = candidateFiles.filter(
    (file) => file.xaiUploadStatus === "uploaded" && typeof file.xaiFileId === "string"
  );
  const readyFiles = uploadedFiles.filter((file) => isRagFileReadyForSemanticSearch(file));
  const blockedFiles = uploadedFiles
    .filter((file) => !isRagFileReadyForSemanticSearch(file))
    .map((file) => evaluateRagFileReadiness(file));

  let linkedCount = 0;
  let alreadyLinkedCount = 0;
  const failed: Array<{ fileId: string; error: string }> = [];
  for (const file of readyFiles) {
    const fileId = file.xaiFileId?.trim();
    if (!fileId) {
      continue;
    }
    try {
      const result = await addFileToXaiCollection({ collectionId, fileId });
      linkedCount += 1;
      if (result.alreadyLinked) {
        alreadyLinkedCount += 1;
      }
    } catch (error) {
      failed.push({
        fileId,
        error: sanitizeLinkFilesError(error)
      });
    }
  }

  return NextResponse.json({
    data: {
      personaId,
      collectionId,
      scope: persona.defaultScope,
      selectedFileIds: Array.from(selectedFileIds),
      selectedCount: selectedFileIds.size,
      candidateFiles: uploadedFiles.length,
      readyCandidates: readyFiles.length,
      blockedCount: blockedFiles.length,
      blockedFiles,
      linkedCount,
      alreadyLinkedCount,
      failed
    }
  });
}

function sanitizeLinkFilesError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Failed to link file to xAI collection";
  }
  const lowered = error.message.toLowerCase();
  if (lowered.includes("not found") || lowered.includes("404")) {
    return "xAI rejected file link (resource not found)";
  }
  if (lowered.includes("unauthorized") || lowered.includes("forbidden") || lowered.includes("401")) {
    return "xAI rejected file link (authorization failed)";
  }
  return "Failed to link file to xAI collection";
}
