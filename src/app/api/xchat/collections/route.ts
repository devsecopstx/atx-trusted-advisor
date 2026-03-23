import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { resolveOrCreateUserBootstrapCollection } from "@/modules/core-admin/access-request-bootstrap";
import { getUserAdminSettings } from "@/modules/core-admin/repository";
import { getPersonaById, resolveDefaultXchatPersonaForSession } from "@/modules/xchat/repository";
import { resolveTeamKbCollectionId } from "@/modules/xchat/team-xai-collection";

type VisibleCollection = {
  collectionId: string;
  collectionName?: string;
  source: "atxfinance_default" | "user_history" | "assigned_persona";
};

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const defaultPersona = await resolveDefaultXchatPersonaForSession(session.roles);
  let activePersonaName = defaultPersona?.name;
  const teamDefaultId = await resolveTeamKbCollectionId();
  const visible: VisibleCollection[] = [];
  if (teamDefaultId) {
    visible.push({
      collectionId: teamDefaultId,
      collectionName: "aTxFinance Default",
      source: "atxfinance_default"
    });
  }

  try {
    const userCollection = await resolveOrCreateUserBootstrapCollection({
      userId: session.userId,
      tenantId: session.tenantId
    });
    if (userCollection?.collectionId?.trim()) {
      visible.push({
        collectionId: userCollection.collectionId.trim(),
        collectionName: userCollection.collectionName,
        source: "user_history"
      });
    }
  } catch (error) {
    console.warn("[xchat/collections] failed to resolve/create user collection", {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  const userSettings = await getUserAdminSettings(session.userId, {
    tenantId: session.tenantId
  });
  const assignedPersonaId = userSettings?.assignedPersonaId?.trim();
  if (assignedPersonaId) {
    const assignedPersona = await getPersonaById(assignedPersonaId);
    if (assignedPersona?.status === "published") {
      activePersonaName = assignedPersona.name;
    }
    const assignedCollectionId = assignedPersona?.xaiCollection?.collectionId?.trim();
    if (assignedCollectionId) {
      visible.push({
        collectionId: assignedCollectionId,
        collectionName: assignedPersona?.xaiCollection?.collectionName,
        source: "assigned_persona"
      });
    }
  }

  const deduped = new Map<string, VisibleCollection>();
  for (const entry of visible) {
    if (!entry.collectionId || deduped.has(entry.collectionId)) {
      continue;
    }
    deduped.set(entry.collectionId, entry);
  }

  return NextResponse.json({
    data: Array.from(deduped.values()),
    metadata: {
      activePersonaName,
      associatedCollectionCount: deduped.size
    }
  });
}
