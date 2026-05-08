import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { deleteXaiCollection, hasXaiManagementApiKey } from "@/lib/xai";

const BOOTSTRAP = "admin_user_bootstrap_profiles";
const CORE_USERS = "core_users";

/**
 * Deletes per-user xAI history collections (management API), clears bootstrap bindings, and unsets `core_users` xAI ids.
 * Used for preference revoke and full user purge (HNWI deletion path).
 */
export async function clearPerUserXaiHistoryCollectionForUserTenant(input: {
  userIdHex: string;
  /** When set, only profiles matching this tenant row; when omitted, all bootstrap rows for the user. */
  tenantIdHex?: string | null;
}): Promise<void> {
  const uid = input.userIdHex.trim();
  if (!ObjectId.isValid(uid)) {
    return;
  }
  const db = await getDb();
  const filter: Record<string, unknown> = { userId: uid };
  const t = input.tenantIdHex?.trim();
  if (t) {
    filter.tenantId = t;
  }

  const profiles = await db
    .collection<{ xaiCollectionId?: string }>(BOOTSTRAP)
    .find(filter)
    .project({ xaiCollectionId: 1 })
    .toArray();

  const collectionIds = [
    ...new Set(
      profiles
        .map((p) => p.xaiCollectionId?.trim())
        .filter((cid): cid is string => Boolean(cid && cid.length > 0))
    )
  ];

  if (hasXaiManagementApiKey()) {
    for (const cid of collectionIds) {
      try {
        await deleteXaiCollection(cid);
      } catch (error) {
        console.warn("[xchat/user-history] xAI collection delete non-fatal", {
          userIdHex: uid,
          collectionId: cid,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  await db.collection(BOOTSTRAP).updateMany(filter, {
    $unset: { xaiCollectionId: "", xaiCollectionName: "" },
    $set: { updatedAt: new Date() }
  });

  await db.collection(CORE_USERS).updateOne(
    { _id: new ObjectId(uid) },
    {
      $unset: { xaiCollectionId: "", xaiCollectionName: "" },
      $set: { updatedAt: new Date() }
    }
  );
}
