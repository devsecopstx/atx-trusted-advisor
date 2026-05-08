import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import {
    getPersonaByIdCached,
    loadDefaultXchatPersonaForSessionDeduped
} from "@/lib/server-request-cache";
import { resolveOrCreateUserBootstrapCollection } from "@/modules/core-admin/access-request-bootstrap";
import { getUserAdminSettings } from "@/modules/core-admin/repository";
import { resolveTeamKbCollectionId } from "@/modules/xchat/team-xai-collection";
import { userHasLongTermXaiMemoryEnabled } from "@/modules/xchat/user-preferences-repository";

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

  const defaultPersona = await loadDefaultXchatPersonaForSessionDeduped(session.roles);
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
    const userOid = ObjectId.isValid(session.userId) ? new ObjectId(session.userId) : null;
    const tenantOid =
      session.tenantId && ObjectId.isValid(session.tenantId) ? new ObjectId(session.tenantId) : null;
    if (
      userOid &&
      (await userHasLongTermXaiMemoryEnabled({ userId: userOid, tenantId: tenantOid }))
    ) {
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
  let assignedPersonaIdForClient: string | null = null;
  if (assignedPersonaId) {
    const assignedPersona = await getPersonaByIdCached(assignedPersonaId);
    if (assignedPersona?.status === "published") {
      activePersonaName = assignedPersona.name;
      assignedPersonaIdForClient = assignedPersonaId;
    }
    const assignedCollectionId = assignedPersona?.teamCollection?.collectionId?.trim();
    if (assignedCollectionId) {
      visible.push({
        collectionId: assignedCollectionId,
        collectionName: assignedPersona?.teamCollection?.collectionName,
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
      associatedCollectionCount: deduped.size,
      /** When set, admin assigned a published persona — xChat ask ignores request `personaId` overrides. */
      assignedPersonaId: assignedPersonaIdForClient
    }
  });
}
